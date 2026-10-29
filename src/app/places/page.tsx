import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlacesManager } from "./PlacesManager";

export const metadata: Metadata = { title: "Saved places" };

export default async function PlacesPage() {
  const user = await requireUser("/places");
  const places = await prisma.place.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <div className="page">
      <h1 className="h1">Saved places</h1>
      <p className="mt-1 text-sm text-fg-muted">Home, hostel, your village, a trip — keep them here and switch between them in one tap.</p>
      <PlacesManager initial={places.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
    </div>
  );
}
