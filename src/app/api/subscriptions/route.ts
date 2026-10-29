import { apiUser, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subscriptionSchema } from "@/lib/schemas";
import { normalisePhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await apiUser();
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return json({ subscriptions });
});

export const POST = handler(async (req: Request) => {
  const user = await apiUser();
  const data = await body(req, subscriptionSchema);
  const count = await prisma.subscription.count({ where: { userId: user.id } });
  if (count >= 10) throw new HttpError(400, "You can have up to 10 reports.");

  let email: string | null = null;
  let phone: string | null = null;
  if (data.channel === "EMAIL") {
    email = data.email || user.email;
    if (!email) throw new HttpError(400, "An email address is required.");
  } else {
    phone = normalisePhone(data.phone || user.phone || "");
    if (!phone) throw new HttpError(400, "Enter a valid mobile number, e.g. 98765 43210.");
    if (!user.phone) await prisma.user.update({ where: { id: user.id }, data: { phone } });
  }

  const subscription = await prisma.subscription.create({
    data: { ...data, email, phone, contactName: user.name, userId: user.id },
  });
  return json({ subscription }, 201);
});
