import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Compare } from "./Compare";

export const metadata: Metadata = { title: "Compare places" };

export default async function ComparePage() {
  const user = await currentUser();
  const places = user ? await prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }) : [];
  return (
    <div className="page">
      <h1 className="h1">Compare two places</h1>
      <p className="mt-1 text-sm text-fg-muted">Side-by-side conditions and the week ahead — handy for trips or checking on family back home.</p>
      <Compare saved={places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, region: p.region, country: p.country }))} />
    </div>
  );
}
