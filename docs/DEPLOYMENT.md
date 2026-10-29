# Deploying SkyCast (Google Cloud VM + Cloudflare Tunnel)

This guide puts the site at **https://weather.rakzu.xyz**, using the same Google Cloud VM and Cloudflare
Tunnel that already serve `share.rakzu.xyz`. Total cost: ₹0 on free tiers.

You will set up, in order:

1. Server software on the VM (Node.js, PostgreSQL, PM2)
2. The app itself
3. Google sign-in
4. Email (Resend + DNS)
5. SMS (textbee, optional)
6. Cloudflare Tunnel hostname
7. Start everything and make yourself admin

---

## 1. Prepare the VM

SSH into the VM (Compute Engine → VM instances → **SSH**), then:

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PostgreSQL
sudo apt-get install -y postgresql
sudo systemctl enable --now postgresql

# PM2 keeps the site and worker running
sudo npm install -g pm2
```

Create the database and a user. Change the password to your own:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER skycast WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE skycast OWNER skycast;
SQL
```

> On an e2-micro VM (1 GB RAM), add a swap file so `npm run build` doesn't run out of memory:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

## 2. Get the code

```bash
cd ~
git clone https://github.com/Rakshan-kaveri/weather.git
cd weather
cp .env.example .env
nano .env
```

Fill in `.env`:

| Variable | Value |
|----------|-------|
| `APP_URL`, `NEXTAUTH_URL` | `https://weather.rakzu.xyz` |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
| `ADMIN_EMAILS` | your Google email(s), comma-separated |
| `DATABASE_URL` | `postgresql://skycast:YOUR_PASSWORD@localhost:5432/skycast?schema=public` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 3 |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` | from step 4 |
| `TEXTBEE_*` | from step 5 (leave blank to skip SMS) |

Then install, create the tables and build:

```bash
npm install
npx prisma db push
npm run build
```

## 3. Google sign-in

1. Open <https://console.cloud.google.com> → choose your project → **APIs & Services**.
2. **OAuth consent screen**: set User type to *External*, App name *SkyCast*, and add your support email.
   Add `rakzu.xyz` under **Authorized domains**. Save.
3. **Credentials** → **Create credentials** → **OAuth client ID** → type *Web application*.
   - Authorized JavaScript origins: `https://weather.rakzu.xyz` (add `http://localhost:3000` for local testing)
   - Authorized redirect URIs: `https://weather.rakzu.xyz/api/auth/callback/google`
     (and `http://localhost:3000/api/auth/callback/google`)
4. Copy the **Client ID** and **Client secret** into `.env`.
5. While the consent screen is in **Testing** mode, only listed **Test users** can sign in. Add your
   teammate's and evaluator's Gmail addresses there, or click **Publish app**. Basic profile/email scopes
   don't need Google review.

## 4. Email with Resend

1. Sign up at <https://resend.com>, then go to **Domains** → **Add domain** → `rakzu.xyz`.
2. Resend shows about 3 DNS records: an MX and an SPF TXT on `send`, and a DKIM TXT on `resend._domainkey`.
   Add each one in **Cloudflare → rakzu.xyz → DNS → Records** with **Proxy status: DNS only** (grey cloud).
   These records don't affect your existing site or mail.
3. Optional but recommended: add a DMARC TXT record named `_dmarc` with value `v=DMARC1; p=none;`.
4. Click **Verify** in Resend and wait until it shows *Verified*.
5. **API Keys** → create a key with *Sending access* → put it in `RESEND_API_KEY`.
   Set `EMAIL_FROM="SkyCast <weather@rakzu.xyz>"`.
6. **Webhooks** → **Add endpoint**:
   - URL: `https://weather.rakzu.xyz/api/webhooks/resend`
   - Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`,
     `email.opened`, `email.failed`
   - Copy the **Signing secret** (`whsec_…`) into `RESEND_WEBHOOK_SECRET`.
7. To show "opened" in the admin panel, turn on **Open tracking** in the domain's settings.

Free plan: 100 emails/day, 3,000/month.

## 5. SMS with textbee (optional)

textbee sends SMS through an Android phone's own SIM, so messages use that SIM's SMS pack.
Free plan: 50 SMS/day, 300/month.

1. Sign up at <https://textbee.dev> and install the textbee Android app on a spare phone with an active SIM
   and an SMS pack.
2. In the dashboard, **Register device** (scan the QR code with the app) and grant SMS permission.
3. Create an **API key**. Copy it into `TEXTBEE_API_KEY` and the device ID into `TEXTBEE_DEVICE_ID`.
4. Create a **webhook**:
   - URL: `https://weather.rakzu.xyz/api/webhooks/textbee`
   - Events: `MESSAGE_SENT`, `MESSAGE_DELIVERED`, `MESSAGE_FAILED`, `MESSAGE_RECEIVED`
   - Signing secret: any random string of 20+ characters, copied into `TEXTBEE_WEBHOOK_SECRET`
   (`MESSAGE_RECEIVED` lets people reply **STOP** to unsubscribe.)
5. Keep the phone charged, on Wi-Fi or data, and exclude the textbee app from battery optimisation.

> **Note:** India's TRAI DLT rules apply to commercial bulk SMS. Sending from a personal SIM is fine for a
> college demo and small pilots. A real service for many farmers would need a DLT-registered SMS provider
> (paid, usually a few paise per SMS). The code only needs a new `sendSms()` in `src/lib/sms.ts` to switch.

## 6. Cloudflare Tunnel

Your tunnel already serves `share.rakzu.xyz`; add a second hostname to it.

**If the tunnel is managed from the Cloudflare dashboard** (Zero Trust → Networks → Tunnels):
open your tunnel → **Public Hostname** → **Add a public hostname**:

- Subdomain `weather`, Domain `rakzu.xyz`
- Service: `HTTP` → `localhost:3000`

**If the tunnel uses a local `config.yml`** (usually `/etc/cloudflared/config.yml`), add a rule *above*
the final `- service: http_status:404` line:

```yaml
  - hostname: weather.rakzu.xyz
    service: http://localhost:3000
```

Then run `cloudflared tunnel route dns <tunnel-name> weather.rakzu.xyz` and `sudo systemctl restart cloudflared`.

**City-level sign-in locations (recommended):** Cloudflare → rakzu.xyz → **Rules → Transform Rules →
Managed Transforms** → turn on **Add visitor location headers**. The admin panel then shows each user's
city without calling any outside service.

## 7. Start it

```bash
cd ~/weather
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # run the command it prints, so PM2 starts on reboot
```

Open https://weather.rakzu.xyz, sign in with the Google account listed in `ADMIN_EMAILS`, and the **Admin**
link appears in the top bar.

### Useful commands

```bash
pm2 status                       # both processes should be "online"
pm2 logs skycast-worker          # see reports being sent
pm2 logs skycast-web
curl localhost:3000/api/health   # {"ok":true,"db":"up"}
```

### Updating after a new push

```bash
cd ~/weather && git pull && npm install && npx prisma db push && npm run build && pm2 restart all
```

## Live satellite & severe-weather data

No keys or sign-ups needed. The server reads:

- **EUMETSAT EUMETView** (`view.eumetsat.int`): Meteosat Indian Ocean and global infrared cloud imagery. Layer names
  and frame times are read from EUMETSAT's live capabilities list every 30 minutes, so the animation always uses real frames.
- **NASA GIBS**: Himawari infrared (10-minute scans) and daily VIIRS true colour.
- **GDACS** (`gdacs.org`): active tropical cyclones, checked every 30 minutes.

The worker scans for thunderstorms, heavy rain, gales and cyclones every 30 minutes (`pm2 logs skycast-worker`).
In the admin panel, **Scan severe weather** runs it immediately.

## Demo checklist (for evaluation)

1. **Map:** open **Satellite** and the clouds animate over India; switch to Wind/Temperature, press play, click a place
   (warnings show at the top of the panel; active cyclones appear as spinning markers).
2. **Dashboard:** allow location → current, 48 h, 7-day, AQI, history.
3. **Sign in** with Google → save two places → **Compare**.
4. **Reports:** create an email report and an SMS report (Kannada + farmer mode) → **Send now**.
5. **Alerts:** create "Rain chance > 10% tomorrow" → Admin → **Check alerts now** → the bell shows it.
6. **Severe weather:** Admin → **Scan severe weather**; the "Severe-weather warnings sent" table and users' bells update.
7. **Admin:** Users (last sign-in, location, report status) → Delivery log (delivered/opened) → Missed today → Resend.
