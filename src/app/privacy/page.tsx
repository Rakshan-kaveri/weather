import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="page max-w-3xl">
      <h1 className="h1">Privacy notice</h1>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-fg-muted">
        <section>
          <h2 className="mb-1 font-semibold text-fg">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your Google account name, email address and profile photo when you sign in.</li>
            <li>Places you save, and the settings for your reports and alerts.</li>
            <li>Your mobile number, only if you add it for SMS.</li>
            <li>
              The approximate city and country of your last sign-in (from your network address, or from your device location if you choose
              &quot;My location&quot;). This helps us spot unusual sign-ins.
            </li>
            <li>A log of the emails and SMS we send you and whether they were delivered.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-1 font-semibold text-fg">What we don&apos;t do</h2>
          <p>We don&apos;t sell or share your data, show ads, or track you across other websites. Your exact device location is never stored unless you use &quot;My location&quot; while signed in.</p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold text-fg">Services we use</h2>
          <p>
            Forecasts: Open-Meteo. Maps &amp; imagery: Esri, CARTO/OpenStreetMap, NASA GIBS, RainViewer. Email delivery: Resend. SMS delivery:
            textbee. Sign-in: Google.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold text-fg">Your choices</h2>
          <p>
            Every email has a one-click unsubscribe link and every SMS can be stopped by replying STOP. You can delete places, reports and
            alerts at any time. To delete your account entirely, contact the site administrator.
          </p>
        </section>
      </div>
    </div>
  );
}
