import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subscriptionSchema } from "@/lib/schemas";
import { normalisePhone } from "@/lib/sms";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new HttpError(404, "Report not found");
  return sub;
}

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const sub = await owned(id, user.id);
  const data = await body(req, subscriptionSchema.partial());
  const update: Record<string, unknown> = { ...data };
  if ("email" in data && !data.email) delete update.email;
  if ("phone" in data && !data.phone) delete update.phone;
  if (data.phone && (data.channel ?? sub.channel) === "SMS") {
    const phone = normalisePhone(data.phone);
    if (!phone) throw new HttpError(400, "Enter a valid mobile number.");
    update.phone = phone;
  }
  const subscription = await prisma.subscription.update({ where: { id }, data: update });
  return json({ subscription });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await owned(id, user.id);
  await prisma.subscription.delete({ where: { id } });
  return json({ ok: true });
});
