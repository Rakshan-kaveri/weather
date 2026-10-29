import { z } from "zod";
import { apiAdmin, body, handler, HttpError, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ blocked: z.boolean().optional(), role: z.enum(["USER", "ADMIN"]).optional() });

/** PATCH /api/admin/users/:id → block / unblock or change role */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await apiAdmin();
  const { id } = await ctx.params;
  const data = await body(req, schema);
  if (id === admin.id && (data.blocked || data.role === "USER")) throw new HttpError(400, "You can't remove your own access.");
  const user = await prisma.user.update({ where: { id }, data });
  if (data.blocked) await prisma.session.deleteMany({ where: { userId: id } });
  return json({ user: { id: user.id, blocked: user.blocked, role: user.role } });
});
