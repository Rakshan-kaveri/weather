import { z } from "zod";
import { apiAdmin, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subscriptionSchema } from "@/lib/schemas";
import { normalisePhone } from "@/lib/sms";

/**
 * POST /api/admin/subscriptions — register an SMS-only subscriber (e.g. a farmer without
 * a smartphone or Google account) on their behalf.
 */
export const POST = handler(async (req: Request) => {
  await apiAdmin();
  const data = await body(req, subscriptionSchema.extend({ contactName: z.string().trim().min(1).max(80) }));
  if (data.channel !== "SMS") throw new HttpError(400, "Only SMS subscribers can be added here.");
  const phone = normalisePhone(data.phone ?? "");
  if (!phone) throw new HttpError(400, "Enter a valid mobile number.");
  const subscription = await prisma.subscription.create({ data: { ...data, phone, email: null, userId: null } });
  return json({ subscription }, 201);
});

const patch = z.object({ id: z.string(), active: z.boolean() });

/** PATCH /api/admin/subscriptions { id, active } → pause / resume any subscription */
export const PATCH = handler(async (req: Request) => {
  await apiAdmin();
  const { id, active } = await body(req, patch);
  const subscription = await prisma.subscription.update({ where: { id }, data: { active } });
  return json({ subscription });
});
