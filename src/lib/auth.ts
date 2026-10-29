import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { isAdminEmail } from "./config";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({ where: { email: user.email }, select: { blocked: true } });
      if (existing?.blocked) return "/login?error=blocked";
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        session.user.id = u.id;
        session.user.role = u.role ?? "USER";
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          ...(isAdminEmail(user.email) ? { role: "ADMIN" } : {}),
        },
      });
    },
  },
};
