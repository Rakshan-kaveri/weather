import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { alertSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await apiUser();
  const alerts = await prisma.alertRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return json({ alerts });
});

export const POST = handler(async (req: Request) => {
  const user = await apiUser();
  const data = await body(req, alertSchema);
  if ((await prisma.alertRule.count({ where: { userId: user.id } })) >= 20) throw new HttpError(400, "You can have up to 20 alerts.");
  if (data.notifySms && !user.phone) throw new HttpError(400, "Add your mobile number in Settings to get SMS alerts.");
  const alert = await prisma.alertRule.create({ data: { ...data, userId: user.id } });
  return json({ alert }, 201);
});
