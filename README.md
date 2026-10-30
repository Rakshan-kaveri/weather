# SkyCast

**Live weather maps, forecasts, alerts and daily weather reports by email and SMS.**

SkyCast is a full-stack weather platform inspired by professional weather maps. Anyone can explore live
satellite, radar, wind, temperature, rain, cloud, pressure and humidity layers on an interactive map.
Signed-in users can save places, compare them, set weather alerts and get a daily forecast by **email** or
**SMS** at a time they choose. SMS reports are available in **English, Kannada and Hindi**, with an optional
**farmer mode** for rural users. An **admin control room** shows every user, where they last signed in from,
whether they subscribed to reports, and whether each report was actually delivered.


---

## Features

| # | Module | What it does |
|---|--------|--------------|
| 1 | **Live weather map** | Full-screen map with 8 layers: **animated live satellite clouds** (Meteosat over India from EUMETSAT every 15 min, Himawari every 10 min, global infrared mosaic, NASA daily true colour), rain radar, rain, animated wind particles, temperature, clouds, pressure, humidity. Timeline playback, colour legends, place search, “my location”, click-anywhere weather, live **cyclone markers with past track, forecast path and wind-impact areas**, a night-lights base under infrared clouds, and **district and taluk boundaries with names** when zoomed in. |
| 2 | **My weather dashboard** | Detects your location (or search any place) and shows current conditions, a 48-hour chart, tomorrow, a 7-day forecast, air quality (PM2.5, PM10, NO₂, O₃) and the past 7 days. |
| 3 | **Google sign-in** | One-click Google login with database sessions. Guests can still use the map and forecasts. |
| 4 | **Saved places & compare** | Save home, hostel, village or trip spots, set a default, rename, and compare two places side by side. |
| 5 | **Daily email & SMS reports** | Choose the place, send time, timezone, days, today/tomorrow forecast, short/detailed format, language and what to include. One-click unsubscribe (email) or reply STOP (SMS). |
| 6 | **Weather alerts** | Rules such as “rain chance > 70% tomorrow” or “max temperature > 40 °C”, checked hourly, delivered in-app, by email or SMS. |
| 7 | **Severe weather warnings** | Every saved or subscribed place is checked every 30 minutes for **thunderstorms** (incl. hail), **heavy rain** using IMD 24-hour categories (64.5 / 115.6 / 204.5 mm), intense downpours, gales, and **tropical cyclones** within range (live GDACS feed). Users are warned automatically in-app, by email and by SMS (Kannada/Hindi/English, including SMS-only farmers). Warning banners appear on the forecast and map. |
| 8 | **Farmer mode** | Spraying, irrigation, heavy-rain and livestock heat advice, in Kannada, Hindi or English. Admins can register SMS-only farmers who have no smartphone or Google account. |
| 9 | **Admin control room** | Users (last sign-in, approximate location, subscription status, last delivery status), missed-today list with one-click resend, full delivery log with delivery and open tracking from webhooks, scheduler health, and block/unblock and role management. |
| 10 | **Settings & PWA** | °C/°F, wind units, 12/24-hour time, dark/light theme. Installable on phones and shows the last forecast offline. |
| 11 | **Live satellite & cyclone tracking** | Live infrared cloud loops (EUMETSAT, Himawari), radar, day/night shading from the real sun position, and tropical cyclone tracks with a forecast cone, intensity colours and dated positions. |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, MapLibre GL JS (WebGL map with globe view), Recharts |
| Backend | Next.js Route Handlers (REST API), Zod validation, node-cron worker |
| Database | PostgreSQL with Prisma ORM |
| Auth | NextAuth (Auth.js) with Google OAuth 2.0 |
| Email | Resend (SMTP fallback supported), signed delivery webhooks |
| SMS | textbee.dev Android SMS gateway, signed delivery webhooks |
| Data | Open-Meteo (forecast, air quality, geocoding), EUMETSAT EUMETView (Meteosat), NASA GIBS (Himawari, VIIRS), GDACS (cyclones), geoBoundaries (district/taluk boundaries), NASA Black Marble (night lights), RainViewer, Esri imagery, OpenFreeMap (OpenStreetMap vector borders & labels) |
| Hosting | Google Cloud VM + PM2 + Cloudflare Tunnel |

## Architecture

```
Browser (Next.js React UI, MapLibre GL WebGL map)
   │  REST /api/*
   ▼
Next.js server ── Prisma ── PostgreSQL
   │                 ▲
   │                 │ deliveries, job runs
   ▼                 │
Open-Meteo / NASA / RainViewer      Worker (node-cron, every 5 min)
                                      ├─ daily reports → Resend (email) / textbee (SMS)
                                      ├─ alert rules (hourly)
                                      └─ severe-weather watch (every 30 min: forecast + GDACS cyclones)
Resend & textbee webhooks → /api/webhooks/* → delivery status (delivered / opened / bounced / failed)
```

### Database tables

`User`, `Account`, `Session`, `VerificationToken` (auth) · `Place` · `Subscription` · `Delivery` ·
`AlertRule` · `Notification` · `SevereNotice` · `LoginEvent` · `JobRun`. See [`prisma/schema.prisma`](prisma/schema.prisma).

### REST API (main endpoints)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/weather?lat&lon` | Current, hourly, 8-day forecast and air quality |
| GET | `/api/grid?w&s&e&n` | Forecast grid for map overlays |
| GET | `/api/geocode?q` · `/api/reverse?lat&lon` | Place search and reverse lookup |
| GET/POST | `/api/places`, PATCH/DELETE `/api/places/:id` | Saved places |
| GET/POST | `/api/subscriptions`, PATCH/DELETE `/api/subscriptions/:id`, POST `/:id/test` | Email/SMS reports |
| GET/POST | `/api/alerts`, PATCH/DELETE `/api/alerts/:id` | Alert rules |
| GET | `/api/warnings?lat&lon` · `/api/cyclones` | Severe-weather warnings and active cyclones |
| GET | `/api/satellite` | Live satellite sources and animation frames |
| POST | `/api/admin/resend`, `/api/admin/run`, `/api/admin/subscriptions` | Admin actions |
| POST | `/api/webhooks/resend`, `/api/webhooks/textbee` | Delivery status callbacks |

## Running locally

```bash
cp .env.example .env          # fill in the values
npm install
npx prisma db push            # create tables
npm run dev                   # http://localhost:3000
npm run worker                # in a second terminal: sends reports & alerts
```

Without `RESEND_API_KEY` / `TEXTBEE_*`, emails and SMS are printed to the console, so everything can be
tested locally.

## Deployment

Step-by-step guide for Google Cloud + Cloudflare Tunnel: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Work split

| Member | Modules |
|--------|---------|
| Member 1 | Live weather map · Saved places & compare · Settings / PWA |
| Member 2 | Google sign-in · Daily email & SMS reports · Weather alerts & severe-weather warnings · Admin control room |
| Shared | My weather dashboard, database design, deployment |

## Credits

Forecast data © [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0) · Satellite imagery © EUMETSAT, NASA EOSDIS GIBS,
JMA Himawari, Esri · Cyclones: GDACS (UN/EC) · Boundaries: geoBoundaries (CC BY 4.0) · Radar: RainViewer · Imagery © Esri · Borders & place names: OpenFreeMap, © OpenStreetMap contributors.
Warnings are automated guidance; always follow official IMD and local authority advisories.
