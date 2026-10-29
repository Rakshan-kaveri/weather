import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AlertsManager } from "./AlertsManager";

export const metadata: Metadata = { title: "Weather alerts" };

export default async function AlertsPage() {
  const user = await requireUser("/alerts");
  const [alerts, places, notes] = await Promise.all([
    prisma.alertRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="page">
      <h1 className="h1">Weather alerts</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Tell us what matters to you — heavy rain tomorrow, a heatwave, poor air — and we&apos;ll warn you by email, SMS or right here in the app.
        Forecasts are checked every hour.
      </p>
      <AlertsManager
        initial={JSON.parse(JSON.stringify(alerts))}
        places={places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }))}
        hasPhone={!!user.phone}
        recent={JSON.parse(JSON.stringify(notes))}
      />
    </div>
  );
}
