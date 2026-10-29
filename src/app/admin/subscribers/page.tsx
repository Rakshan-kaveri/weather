import { prisma } from "@/lib/prisma";
import { smsEnabled } from "@/lib/sms";
import { config } from "@/lib/config";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { PreviewButton, ResendButton, SubToggle } from "../AdminActions";
import { AddFarmer } from "./AddFarmer";

export const metadata = { title: "Subscribers · Admin" };

type Props = { searchParams: Promise<{ channel?: string }> };

export default async function Subscribers({ searchParams }: Props) {
  const { channel } = await searchParams;
  const subs = await prisma.subscription.findMany({
    where: channel === "EMAIL" || channel === "SMS" ? { channel } : {},
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="grid gap-5">
      <AddFarmer smsAvailable={smsEnabled()} defaultTimezone={config.defaultTimezone} />

      <div className="flex gap-1">
        {[
          ["", "All"],
          ["EMAIL", "Email"],
          ["SMS", "SMS"],
        ].map(([v, l]) => (
          <a key={v} href={v ? `?channel=${v}` : "?"} className={`rounded-lg px-3 py-1.5 text-sm ${(channel ?? "") === v ? "bg-ink-700 text-fg" : "text-fg-muted hover:text-fg"}`}>
            {l}
          </a>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr>
              <th className="table-head">Subscriber</th>
              <th className="table-head">Channel</th>
              <th className="table-head">Place</th>
              <th className="table-head">Schedule</th>
              <th className="table-head">Options</th>
              <th className="table-head">Last delivery</th>
              <th className="table-head">State</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 && (
              <tr>
                <td colSpan={8} className="table-cell py-8 text-center text-fg-muted">
                  No subscribers yet.
                </td>
              </tr>
            )}
            {subs.map((s) => {
              const last = s.deliveries[0];
              return (
                <tr key={s.id}>
                  <td className="table-cell">
                    <div className="font-medium">{s.user?.name ?? s.contactName ?? "—"}</div>
                    <div className="text-xs text-fg-faint">{s.channel === "EMAIL" ? s.email : s.phone}</div>
                    {!s.userId && <div className="text-[11px] text-good">added by admin</div>}
                  </td>
                  <td className="table-cell">{s.channel}</td>
                  <td className="table-cell">{s.placeName}</td>
                  <td className="table-cell whitespace-nowrap text-sm">
                    {s.sendTime}
                    <div className="text-xs text-fg-faint">{s.days.length === 7 ? "daily" : `${s.days.length} days/wk`} · {s.forecastDay}</div>
                  </td>
                  <td className="table-cell text-xs text-fg-muted">
                    {s.format} · {s.language}
                    {s.farmerTips && " · farmer"}
                  </td>
                  <td className="table-cell">
                    {last ? (
                      <div className="flex items-center gap-2" title={last.error ?? ""}>
                        <StatusBadge status={last.status} />
                        <span className="text-xs text-fg-faint">{timeAgo(last.createdAt)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-fg-faint">never</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={s.active ? "ACTIVE" : "PAUSED"} />
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1.5">
                      <PreviewButton subscriptionId={s.id} />
                      <ResendButton subscriptionId={s.id} label="Send" />
                      <SubToggle id={s.id} active={s.active} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
