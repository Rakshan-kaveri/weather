import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { alertSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  const rule = await prisma.alertRule.findFirst({ where: { id, userId } });
  if (!rule) throw new HttpError(404, "Alert not found");
  return rule;
}

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await owned(id, user.id);
  const data = await body(req, alertSchema.partial());
  const alert = await prisma.alertRule.update({ where: { id }, data: { ...data, lastTriggeredFor: null } });
  return json({ alert });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await owned(id, user.id);
  await prisma.alertRule.delete({ where: { id } });
  return json({ ok: true });
});
