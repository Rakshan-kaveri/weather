import { z } from "zod";
import { apiUser, body, handler, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await apiUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return json({ items, unread });
});

/** POST { ids?: string[] } → mark as read (all when ids omitted) */
export const POST = handler(async (req: Request) => {
  const user = await apiUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).optional() }));
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return json({ ok: true });
});
