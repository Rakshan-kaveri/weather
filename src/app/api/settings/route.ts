import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/schemas";
import { normalisePhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const u = await apiUser();
  return json({ tempUnit: u.tempUnit, windUnit: u.windUnit, timeFormat: u.timeFormat, theme: u.theme, phone: u.phone, name: u.name });
});

export const PATCH = handler(async (req: Request) => {
  const user = await apiUser();
  const data = await body(req, settingsSchema);
  const update: Record<string, unknown> = { ...data };
  if (data.phone !== undefined) {
    if (data.phone === null || data.phone === "") update.phone = null;
    else {
      const phone = normalisePhone(data.phone);
      if (!phone) throw new HttpError(400, "Enter a valid mobile number, e.g. 98765 43210.");
      update.phone = phone;
    }
  }
  const u = await prisma.user.update({ where: { id: user.id }, data: update });
  return json({ tempUnit: u.tempUnit, windUnit: u.windUnit, timeFormat: u.timeFormat, theme: u.theme, phone: u.phone, name: u.name });
});
