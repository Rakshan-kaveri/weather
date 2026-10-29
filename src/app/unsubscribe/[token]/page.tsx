import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Unsubscribed" };

type Props = { params: Promise<{ token: string }> };

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const sub = await prisma.subscription.findUnique({ where: { unsubscribeToken: token } });
  if (sub?.active) await prisma.subscription.update({ where: { id: sub.id }, data: { active: false } });

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="card max-w-md p-7 text-center">
        {sub ? (
          <>
            <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm text-fg-muted">
              You won&apos;t get the daily {sub.channel === "EMAIL" ? "email" : "SMS"} for <strong>{sub.placeName}</strong> any more.
            </p>
            {sub.userId && (
              <Link href="/subscriptions" className="btn-primary mt-5">
                Manage or resume reports
              </Link>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Link not recognised</h1>
            <p className="mt-2 text-sm text-fg-muted">This unsubscribe link is invalid or the report was already deleted.</p>
          </>
        )}
      </div>
    </div>
  );
}
