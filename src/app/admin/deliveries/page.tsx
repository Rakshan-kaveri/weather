import Link from "next/link";
import type { Channel, DeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { ResendButton } from "../AdminActions";

export const metadata = { title: "Delivery log · Admin" };

const STATUSES: DeliveryStatus[] = ["QUEUED", "SENT", "DELIVERED", "OPENED", "BOUNCED", "FAILED"];
const PAGE = 50;

type Props = { searchParams: Promise<{ status?: string; channel?: string; q?: string; page?: string }> };

export default async function DeliveryLog({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.DeliveryWhereInput = {
    ...(sp.status && STATUSES.includes(sp.status as DeliveryStatus) ? { status: sp.status as DeliveryStatus } : {}),
    ...(sp.channel === "EMAIL" || sp.channel === "SMS" ? { channel: sp.channel as Channel } : {}),
    ...(sp.q ? { to: { contains: sp.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { subscription: { select: { placeName: true, contactName: true, user: { select: { name: true } } } } },
    }),
    prisma.delivery.count({ where }),
  ]);
  const qs = (p: Record<string, string | undefined>) =>
    "?" +
    new URLSearchParams(
      Object.entries({ status: sp.status, channel: sp.channel, q: sp.q, ...p }).filter(([, v]) => v) as [string, string][],
    ).toString();

  return (
    <div className="grid gap-4">
      <form className="flex flex-wrap gap-2" action="/admin/deliveries">
        <input name="q" defaultValue={sp.q} placeholder="Email or phone" className="input max-w-xs" aria-label="Recipient" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="input w-auto" aria-label="Channel">
          <option value="">Email & SMS</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr>
              <th className="table-head">Time</th>
              <th className="table-head">Recipient</th>
              <th className="table-head">Type</th>
              <th className="table-head">Place / subject</th>
              <th className="table-head">Status</th>
              <th className="table-head">Delivered / opened</th>
              <th className="table-head">Error</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="table-cell py-8 text-center text-fg-muted">
                  No deliveries match.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="table-cell whitespace-nowrap text-xs text-fg-faint">{formatDateTime(d.createdAt)}</td>
                <td className="table-cell">
                  <div>{d.subscription?.user?.name ?? d.subscription?.contactName ?? "—"}</div>
                  <div className="text-xs text-fg-faint">
                    {d.channel} · {d.to}
                  </div>
                </td>
                <td className="table-cell text-xs">{d.kind.split(":")[0]}</td>
                <td className="table-cell max-w-[260px]">
                  <div className="truncate" title={d.subject ?? d.preview ?? ""}>
                    {d.subject ?? d.subscription?.placeName ?? "—"}
                  </div>
                </td>
                <td className="table-cell">
                  <StatusBadge status={d.status} />
                </td>
                <td className="table-cell whitespace-nowrap text-xs text-fg-faint">
                  {d.deliveredAt ? formatDateTime(d.deliveredAt) : "—"}
                  {d.openedAt && <div>opened {formatDateTime(d.openedAt)}</div>}
                </td>
                <td className="table-cell max-w-[240px] truncate text-xs text-bad" title={d.error ?? ""}>
                  {d.error}
                </td>
                <td className="table-cell text-right">
                  {d.subscriptionId && (d.status === "FAILED" || d.status === "BOUNCED") && <ResendButton subscriptionId={d.subscriptionId} label="Retry" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>
          {total} deliver{total === 1 ? "y" : "ies"} · page {page} of {Math.max(1, Math.ceil(total / PAGE))}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link className="btn-ghost py-1.5" href={qs({ page: String(page - 1) })}>
              Previous
            </Link>
          )}
          {page * PAGE < total && (
            <Link className="btn-ghost py-1.5" href={qs({ page: String(page + 1) })}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
