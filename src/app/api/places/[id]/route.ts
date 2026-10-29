import { z } from "zod";
import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  const place = await prisma.place.findFirst({ where: { id, userId } });
  if (!place) throw new HttpError(404, "Place not found");
  return place;
}

const patchSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), isDefault: z.literal(true).optional() });

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await owned(id, user.id);
  const data = await body(req, patchSchema);
  const place = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.place.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    return tx.place.update({ where: { id }, data });
  });
  return json({ place });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const place = await owned(id, user.id);
  await prisma.place.delete({ where: { id } });
  if (place.isDefault) {
    const next = await prisma.place.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.place.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return json({ ok: true });
});
