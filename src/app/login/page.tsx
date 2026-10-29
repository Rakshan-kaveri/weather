import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginCard } from "./LoginCard";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await currentUser()) redirect(safeNext);
  return (
    <div className="relative grid min-h-[calc(100vh-64px)] place-items-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 400px at 20% 10%, rgba(78,168,255,0.18), transparent 60%), radial-gradient(700px 400px at 90% 90%, rgba(120,90,255,0.15), transparent 60%)",
        }}
      />
      <LoginCard next={safeNext} error={error} />
    </div>
  );
}
