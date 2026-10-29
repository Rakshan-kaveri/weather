import { z } from "zod";
import { apiAdmin, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deliver } from "@/lib/deliver";
import { localParts } from "@/lib/time";

/** POST /api/admin/resend { subscriptionId } → send today's report again right now */
export const POST = handler(async (req: Request) => {
  await apiAdmin();
  const { subscriptionId } = await body(req, z.object({ subscriptionId: z.string() }));
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new HttpError(404, "Subscription not found");
  const r = await deliver(sub, "resend", localParts(new Date(), sub.timezone).date);
  if (!r.ok) throw new HttpError(502, r.error);
  return json({ ok: true });
});
