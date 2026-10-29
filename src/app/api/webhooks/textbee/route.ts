import { prisma } from "@/lib/prisma";
import { verifyTextbee } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/textbee — SMS status events (sent / delivered / failed)
 * and incoming replies. Replying "STOP" turns off that number's SMS reports.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.TEXTBEE_WEBHOOK_SECRET;
  if (!secret || !verifyTextbee(raw, req.headers, secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const event: string = evt.webhookEvent ?? evt.event ?? "";

  if (event === "MESSAGE_RECEIVED") {
    const text = String(evt.message ?? "").trim().toUpperCase();
    const sender = String(evt.sender ?? "");
    if (sender && ["STOP", "UNSUBSCRIBE", "CANCEL"].includes(text)) {
      await prisma.subscription.updateMany({ where: { channel: "SMS", phone: sender }, data: { active: false } });
    }
    return Response.json({ ok: true });
  }

  const batchId: string | undefined = evt.smsBatchId;
  if (!batchId) return Response.json({ ok: true, ignored: true });
  const delivery = await prisma.delivery.findFirst({ where: { providerId: batchId } });
  if (!delivery) return Response.json({ ok: true, unknown: true });

  if (event === "MESSAGE_DELIVERED") {
    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  } else if (event === "MESSAGE_FAILED" || event === "UNKNOWN_STATE") {
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", error: evt.errorMessage || evt.errorCode || event },
    });
  } else if (event === "MESSAGE_SENT" && delivery.status === "QUEUED") {
    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "SENT" } });
  }
  return Response.json({ ok: true });
}
