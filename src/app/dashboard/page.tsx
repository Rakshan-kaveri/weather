import { zoomEarthEmbedEnabled } from "@/lib/zoomEarth";
import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "./Dashboard";

export const metadata: Metadata = { title: "My weather" };

export default async function DashboardPage() {
  const user = await currentUser();
  const places = user
    ? await prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })
    : [];
  return (
    <div className="page">
      <Dashboard
        signedIn={!!user}
        zoomEarth={zoomEarthEmbedEnabled()}
        firstName={user?.name?.split(" ")[0] ?? null}
        places={places.map((p) => ({ id: p.id, name: p.name, region: p.region, country: p.country, lat: p.lat, lon: p.lon, isDefault: p.isDefault }))}
      />
    </div>
  );
}
