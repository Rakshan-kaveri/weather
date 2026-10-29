import { prisma } from "@/lib/prisma";
import { verifyResend } from "@/lib/webhooks";
import type { DeliveryStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS: Record<string, DeliveryStatus> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "OPENED",
  "email.bounced": "BOUNCED",
  "email.complained": "BOUNCED",
  "email.failed": "FAILED",
};

// Status only moves forward (a late "sent" event must not undo "delivered").
const RANK: Record<DeliveryStatus, number> = { QUEUED: 0, SKIPPED: 0, SENT: 1, DELIVERED: 2, OPENED: 3, BOUNCED: 4, FAILED: 4 };

/** POST /api/webhooks/resend — delivery events from Resend update the delivery log. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !verifyResend(raw, req.headers, secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const status = STATUS[evt.type];
  const emailId: string | undefined = evt.data?.email_id;
  if (!status || !emailId) return Response.json({ ok: true, ignored: true });

  const delivery = await prisma.delivery.findFirst({ where: { providerId: emailId } });
  if (!delivery) return Response.json({ ok: true, unknown: true });

  if (RANK[status] >= RANK[delivery.status]) {
    const at = evt.created_at ? new Date(evt.created_at) : new Date();
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status,
        ...(status === "DELIVERED" ? { deliveredAt: at } : {}),
        ...(status === "OPENED" ? { openedAt: at, deliveredAt: delivery.deliveredAt ?? at } : {}),
        ...(status === "BOUNCED" || status === "FAILED"
          ? { error: evt.data?.bounce?.message || evt.data?.failed?.reason || evt.type }
          : {}),
      },
    });
  }
  return Response.json({ ok: true });
}
