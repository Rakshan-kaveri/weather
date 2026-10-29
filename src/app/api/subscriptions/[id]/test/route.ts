import { apiUser, handler, HttpError, json, limit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deliver } from "@/lib/deliver";
import { localParts } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/subscriptions/:id/test → send this report right now */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  limit(req, "test-send", 5, 600);
  const user = await apiUser();
  const { id } = await ctx.params;
  const sub = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
  if (!sub) throw new HttpError(404, "Report not found");
  const r = await deliver(sub, "test", localParts(new Date(), sub.timezone).date);
  if (!r.ok) throw new HttpError(502, `Could not send: ${r.error}`);
  return json({ ok: true });
});
