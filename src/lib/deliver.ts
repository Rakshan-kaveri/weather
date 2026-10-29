import { Prisma, type Subscription } from "@prisma/client";
import { prisma } from "./prisma";
import { buildReport } from "./report";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { config } from "./config";
import { hhmmToMinutes, localParts } from "./time";

const MAX_ATTEMPTS = 3;
/** Only send a missed report if we are still within this many minutes of the chosen time. */
const SEND_WINDOW_MIN = 180;

export type Kind = "daily" | "test" | "resend";

/**
 * Builds and sends one report, recording every step on a Delivery row so the admin panel
 * can show exactly who got their weather and who didn't.
 */
export async function deliver(sub: Subscription, kind: Kind, forDate: string, existingId?: string) {
  const to = sub.channel === "EMAIL" ? sub.email : sub.phone;
  if (!to) throw new Error("Subscription has no destination");

  const delivery = existingId
    ? await prisma.delivery.update({
        where: { id: existingId },
        data: { status: "QUEUED", attempts: { increment: 1 }, error: null },
      })
    : await prisma.delivery.create({
        data: {
          subscriptionId: sub.id,
          userId: sub.userId,
          channel: sub.channel,
          to,
          kind: kind === "daily" ? "daily" : `${kind}:${Date.now()}`,
          forDate,
          status: "QUEUED",
          attempts: 1,
        },
      });

  try {
    const report = await buildReport(sub);
    const result =
      sub.channel === "EMAIL"
        ? await sendEmail({
            to,
            subject: report.subject,
            html: report.html,
            text: report.text,
            unsubscribeUrl: `${config.appUrl}/api/unsubscribe?token=${sub.unsubscribeToken}`,
          })
        : await sendSms(to, report.sms);

    await prisma.$transaction([
      prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: result.provider === "console" ? "DELIVERED" : "SENT",
          providerId: result.id,
          subject: sub.channel === "EMAIL" ? report.subject : null,
          preview: sub.channel === "EMAIL" ? report.text.slice(0, 600) : report.sms,
          sentAt: new Date(),
          ...(result.provider === "console" ? { deliveredAt: new Date() } : {}),
        },
      }),
      prisma.subscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } }),
    ]);
    return { ok: true as const, deliveryId: delivery.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "FAILED", error: message.slice(0, 1000) } });
    return { ok: false as const, deliveryId: delivery.id, error: message };
  }
}

/** Is this subscription due right now, and for which local date? */
export function dueInfo(sub: Subscription, now = new Date()) {
  const local = localParts(now, sub.timezone);
  const due = sub.days.includes(local.dow) && local.minutes >= hhmmToMinutes(sub.sendTime);
  const inWindow = local.minutes - hhmmToMinutes(sub.sendTime) <= SEND_WINDOW_MIN;
  return { ...local, due, inWindow };
}

/** Runs every few minutes from the worker. Sends due reports and retries recent failures. */
export async function runDailyReports(now = new Date()) {
  const run = await prisma.jobRun.create({ data: { job: "daily-reports" } });
  let processed = 0;
  let sent = 0;
  let failed = 0;
  try {
    const subs = await prisma.subscription.findMany({
      where: { active: true, OR: [{ userId: null }, { user: { blocked: false } }] },
    });
    for (const sub of subs) {
      const info = dueInfo(sub, now);
      if (!info.due || !info.inWindow) continue;

      const existing = await prisma.delivery.findUnique({
        where: { subscriptionId_forDate_kind: { subscriptionId: sub.id, forDate: info.date, kind: "daily" } },
      });
      if (existing && (existing.status !== "FAILED" || existing.attempts >= MAX_ATTEMPTS)) continue;

      processed++;
      try {
        const r = await deliver(sub, "daily", info.date, existing?.id);
        if (r.ok) sent++;
        else failed++;
      } catch (err) {
        // Unique violation = another worker already picked this one up.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        failed++;
        console.error("[daily-reports]", sub.id, err);
      }
      // Be gentle with the SMS phone and the email API.
      await new Promise((r) => setTimeout(r, sub.channel === "SMS" ? 1500 : 250));
    }
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), processed, sent, failed, ok: true },
    });
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), processed, sent, failed, ok: false, message: String(err).slice(0, 1000) },
    });
    throw err;
  }
  return { processed, sent, failed };
}

/** Subscriptions whose time has passed today but have no successful delivery. */
export async function missedToday(now = new Date()) {
  const subs = await prisma.subscription.findMany({
    where: { active: true },
    include: { user: { select: { name: true, email: true } } },
  });
  const rows = [];
  for (const sub of subs) {
    const info = dueInfo(sub, now);
    if (!info.due) continue;
    const ok = await prisma.delivery.findFirst({
      where: {
        subscriptionId: sub.id,
        forDate: info.date,
        status: { in: ["SENT", "DELIVERED", "OPENED"] },
      },
      select: { id: true },
    });
    if (ok) continue;
    const last = await prisma.delivery.findFirst({
      where: { subscriptionId: sub.id, forDate: info.date },
      orderBy: { createdAt: "desc" },
    });
    rows.push({ sub, localDate: info.date, last });
  }
  return rows;
}
