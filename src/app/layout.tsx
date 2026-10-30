import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { zoomEarthEmbedEnabled } from "@/lib/zoomEarth";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { Toaster } from "@/components/Toast";
import { currentUser } from "@/lib/session";
import type { Prefs } from "@/lib/units";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "SkyCast — Live weather map & forecasts", template: "%s · SkyCast" },
  description:
    "Live satellite, radar, wind and temperature maps with hourly and 7-day forecasts, saved places, weather alerts and daily reports by email or SMS.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  applicationName: "SkyCast",
};

export const viewport: Viewport = {
  themeColor: "#06090f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  const prefs: Prefs | undefined = user
    ? {
        tempUnit: user.tempUnit as Prefs["tempUnit"],
        windUnit: user.windUnit as Prefs["windUnit"],
        timeFormat: user.timeFormat as Prefs["timeFormat"],
        theme: user.theme as Prefs["theme"],
      }
    : undefined;

  return (
    <html lang="en" className={prefs?.theme === "light" ? "theme-light" : "theme-dark"}>
      <body className="min-h-full font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[3000] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <Providers initialPrefs={prefs} signedIn={!!user}>
          <Header zoomEarth={zoomEarthEmbedEnabled()} />
          <main id="main">{children}</main>
          {user && <PresenceBeacon />}
          <Toaster />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
