import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.blocked) return null;
  return user;
}

/** For server components/pages: redirect to login when signed out. */
export async function requireUser(next = "/dashboard") {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
