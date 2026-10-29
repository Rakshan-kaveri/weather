import { z } from "zod";
import { apiAdmin, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildReport } from "@/lib/report";
import { sendEmail } from "@/lib/email";

/** POST /api/admin/test-email { subscriptionId } → email a preview of any report to the admin */
export const POST = handler(async (req: Request) => {
  const admin = await apiAdmin();
  const { subscriptionId } = await body(req, z.object({ subscriptionId: z.string() }));
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new HttpError(404, "Subscription not found");
  if (!admin.email) throw new HttpError(400, "Your account has no email");
  const report = await buildReport(sub);
  await sendEmail({
    to: admin.email,
    subject: `[Preview] ${report.subject}`,
    html: report.html,
    text: sub.channel === "SMS" ? `SMS preview:\n\n${report.sms}` : report.text,
  });
  return json({ ok: true, sms: sub.channel === "SMS" ? report.sms : undefined });
});
