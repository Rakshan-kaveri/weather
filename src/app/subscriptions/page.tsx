import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { smsEnabled } from "@/lib/sms";
import { config } from "@/lib/config";
import { Subscriptions } from "./Subscriptions";

export const metadata: Metadata = { title: "Daily reports" };

type Props = { searchParams: Promise<{ lat?: string; lon?: string; name?: string }> };

export default async function SubscriptionsPage({ searchParams }: Props) {
  const user = await requireUser("/subscriptions");
  const sp = await searchParams;
  const [subs, places] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 3 } },
    }),
    prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
  ]);
  const prefill =
    sp.lat && sp.lon && Number.isFinite(Number(sp.lat)) && Number.isFinite(Number(sp.lon))
      ? { lat: Number(sp.lat), lon: Number(sp.lon), name: sp.name || "Selected place" }
      : null;

  return (
    <div className="page">
      <h1 className="h1">Daily weather reports</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Get the day&apos;s or tomorrow&apos;s weather delivered at the time you choose — by email, or by SMS for places with patchy internet.
        Farmer mode adds spraying, irrigation and livestock advice. SMS can be in English, Kannada or Hindi.
      </p>
      <Subscriptions
        initial={JSON.parse(JSON.stringify(subs))}
        places={places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }))}
        userEmail={user.email ?? ""}
        userPhone={user.phone ?? ""}
        prefill={prefill}
        smsAvailable={smsEnabled()}
        defaultTimezone={config.defaultTimezone}
      />
    </div>
  );
}
