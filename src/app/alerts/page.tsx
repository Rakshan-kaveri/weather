import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AlertsManager } from "./AlertsManager";

export const metadata: Metadata = { title: "Weather alerts" };

export default async function AlertsPage() {
  const user = await requireUser("/alerts");
  const [alerts, places, notes, severe] = await Promise.all([
    prisma.alertRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.severeNotice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return (
    <div className="page">
      <h1 className="h1">Weather alerts</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Tell us what matters to you — heavy rain tomorrow, a heatwave, poor air — and we&apos;ll warn you by email, SMS or right here in the app.
        Forecasts are checked every hour.
      </p>
      <section className="card mt-6 flex flex-wrap items-start gap-4 border-warn/30 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Automatic storm, heavy-rain &amp; cyclone warnings are on</h2>
          <p className="mt-1 text-sm text-fg-muted">
            No setup needed — every saved place is watched for thunderstorms, IMD heavy-rain levels, gales and cyclones within reach.
            Choose how you&apos;re told in <a href="/settings" className="text-accent">Settings</a>.
          </p>
          {severe.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {severe.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${n.level === "severe" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"}`}>{n.level}</span>
                  <span className="font-medium">{n.title}</span>
                  <span className="text-xs text-fg-faint">{n.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <AlertsManager
        initial={JSON.parse(JSON.stringify(alerts))}
        places={places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }))}
        hasPhone={!!user.phone}
        recent={JSON.parse(JSON.stringify(notes))}
      />
    </div>
  );
}
