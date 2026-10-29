import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placeSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await apiUser();
  const places = await prisma.place.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return json({ places });
});

export const POST = handler(async (req: Request) => {
  const user = await apiUser();
  const data = await body(req, placeSchema);
  const count = await prisma.place.count({ where: { userId: user.id } });
  if (count >= 25) throw new HttpError(400, "You can save up to 25 places.");
  const makeDefault = data.isDefault || count === 0;
  const place = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.place.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    return tx.place.create({ data: { ...data, isDefault: makeDefault, userId: user.id } });
  });
  return json({ place }, 201);
});
