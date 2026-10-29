import { handler, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** One-click unsubscribe (RFC 8058) used by the List-Unsubscribe email header. */
export const POST = handler(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token");
  if (token) await prisma.subscription.updateMany({ where: { unsubscribeToken: token }, data: { active: false } });
  return json({ ok: true });
});

export const GET = handler(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return Response.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url), 303);
});
