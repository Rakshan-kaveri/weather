import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { missedToday } from "@/lib/deliver";
import { emailProvider } from "@/lib/email";
import { smsEnabled } from "@/lib/sms";
import { formatDateTime, timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { ResendButton, RunJobButton } from "./AdminActions";
import { DeliveryChart } from "./DeliveryChart";

export const metadata = { title: "Admin" };

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

export default async function AdminOverview() {
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600_000);

  const [users, newUsers, activeToday, emailSubs, smsSubs, alerts, last24, lastReportsRun, lastAlertsRun, recentFailures, missed, recentDeliveries, lastSevereRun, severeRecent, severe24] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gt: weekAgo } } }),
      prisma.user.count({ where: { lastSeenAt: { gt: dayAgo } } }),
      prisma.subscription.count({ where: { active: true, channel: "EMAIL" } }),
      prisma.subscription.count({ where: { active: true, channel: "SMS" } }),
      prisma.alertRule.count({ where: { active: true } }),
      prisma.delivery.groupBy({ by: ["status"], where: { createdAt: { gt: dayAgo } }, _count: true }),
      prisma.jobRun.findFirst({ where: { job: "daily-reports" }, orderBy: { startedAt: "desc" } }),
      prisma.jobRun.findFirst({ where: { job: "alerts" }, orderBy: { startedAt: "desc" } }),
      prisma.delivery.findMany({ where: { status: { in: ["FAILED", "BOUNCED"] }, createdAt: { gt: weekAgo } }, orderBy: { createdAt: "desc" }, take: 8 }),
      missedToday(),
      prisma.delivery.findMany({ where: { createdAt: { gt: twoWeeksAgo } }, select: { createdAt: true, status: true } }),
      prisma.jobRun.findFirst({ where: { job: "severe-weather" }, orderBy: { startedAt: "desc" } }),
      prisma.severeNotice.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } }, subscription: { select: { contactName: true } } },
      }),
      prisma.severeNotice.count({ where: { createdAt: { gt: dayAgo } } }),
    ]);

  const count = (s: string) => last24.find((x) => x.status === s)?._count ?? 0;
  const sent24 = last24.reduce((a, x) => a + x._count, 0);
  const ok24 = count("SENT") + count("DELIVERED") + count("OPENED");
  const bad24 = count("FAILED") + count("BOUNCED");
  const reportsStale = !lastReportsRun || Date.now() - lastReportsRun.startedAt.getTime() > 15 * 60_000;

  // Deliveries per day for the chart (last 14 days)
  const byDay = new Map<string, { ok: number; failed: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    byDay.set(d, { ok: 0, failed: 0 });
  }
  for (const d of recentDeliveries) {
    const key = d.createdAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const row = byDay.get(key);
    if (!row) continue;
    if (d.status === "FAILED" || d.status === "BOUNCED") row.failed++;
    else row.ok++;
  }
  const chart = [...byDay.entries()].map(([date, v]) => ({ date: date.slice(5), ...v }));

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Users" value={users} sub={`+${newUsers} this week`} />
        <Stat label="Active today" value={activeToday} sub="seen in last 24 h" />
        <Stat label="Email reports" value={emailSubs} sub="active" />
        <Stat label="SMS reports" value={smsSubs} sub={smsEnabled() ? "gateway on" : "gateway not configured"} tone={smsEnabled() ? undefined : "warn"} />
        <Stat label="Sent (24 h)" value={sent24} sub={`${ok24} ok · ${bad24} failed`} tone={bad24 ? "warn" : "good"} />
        <Stat label="Missed today" value={missed.length} sub="due but not delivered" tone={missed.length ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Deliveries · last 14 days</h2>
          <DeliveryChart data={chart} />
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Scheduler health</h2>
          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${reportsStale ? "border-bad/40 bg-bad/10 text-bad" : "border-good/40 bg-good/10 text-good"}`}>
            {reportsStale ? "Worker hasn't run in the last 15 minutes — check `pm2 status`." : "Worker is running normally."}
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-fg-faint">Daily reports job</dt>
              <dd>
                {lastReportsRun ? (
                  <>
                    {timeAgo(lastReportsRun.startedAt)} · {lastReportsRun.sent} sent, {lastReportsRun.failed} failed
                    {!lastReportsRun.ok && <span className="text-bad"> · error</span>}
                  </>
                ) : (
                  "never run"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-fg-faint">Alerts job</dt>
              <dd>{lastAlertsRun ? `${timeAgo(lastAlertsRun.startedAt)} · ${lastAlertsRun.processed} rules checked, ${lastAlertsRun.sent} sent` : "never run"}</dd>
            </div>
            <div>
              <dt className="text-fg-faint">Severe-weather watch</dt>
              <dd>{lastSevereRun ? `${timeAgo(lastSevereRun.startedAt)} · ${lastSevereRun.processed} hazards found, ${lastSevereRun.sent} messages sent` : "never run"}</dd>
            </div>
            <div>
              <dt className="text-fg-faint">Email provider</dt>
              <dd className="capitalize">{emailProvider() === "console" ? "not configured (logging only)" : emailProvider()}</dd>
            </div>
            <div>
              <dt className="text-fg-faint">Active alert rules</dt>
              <dd>{alerts}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <RunJobButton job="daily-reports" label="Run reports now" />
            <RunJobButton job="alerts" label="Check alerts now" />
            <RunJobButton job="severe-weather" label="Scan severe weather" />
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Severe-weather warnings sent</h2>
          <span className="text-xs text-fg-faint">{severe24} in the last 24 h</span>
        </div>
        {severeRecent.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-fg-muted">No thunderstorm, heavy-rain or cyclone warnings have been needed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <tbody>
                {severeRecent.map((n) => (
                  <tr key={n.id}>
                    <td className="table-cell whitespace-nowrap text-xs text-fg-faint">{formatDateTime(n.createdAt)}</td>
                    <td className="table-cell">{n.user?.name ?? n.subscription?.contactName ?? "—"}</td>
                    <td className="table-cell">
                      <span className={`chip ${n.level === "severe" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"}`}>{n.level}</span>
                    </td>
                    <td className="table-cell font-medium">{n.title}</td>
                    <td className="table-cell text-xs text-fg-muted">{n.channels.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Missed today — due but not delivered</h2>
          <span className="text-xs text-fg-faint">{missed.length} subscriber{missed.length === 1 ? "" : "s"}</span>
        </div>
        {missed.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-good">Everyone due so far today has received their report.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="table-head">Subscriber</th>
                  <th className="table-head">Channel</th>
                  <th className="table-head">Place</th>
                  <th className="table-head">Due at</th>
                  <th className="table-head">Last attempt</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody>
                {missed.map(({ sub, last }) => (
                  <tr key={sub.id}>
                    <td className="table-cell">
                      <div className="font-medium">{sub.user?.name ?? sub.contactName ?? "—"}</div>
                      <div className="text-xs text-fg-faint">{sub.channel === "EMAIL" ? sub.email : sub.phone}</div>
                    </td>
                    <td className="table-cell">{sub.channel}</td>
                    <td className="table-cell">{sub.placeName}</td>
                    <td className="table-cell">
                      {sub.sendTime} <span className="text-xs text-fg-faint">{sub.timezone}</span>
                    </td>
                    <td className="table-cell">
                      {last ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={last.status} />
                          <span className="max-w-[240px] truncate text-xs text-fg-faint" title={last.error ?? ""}>
                            {last.error ?? ""}
                          </span>
                        </div>
                      ) : (
                        <StatusBadge status="MISSED" title="No attempt yet — worker may be down" />
                      )}
                    </td>
                    <td className="table-cell text-right">
                      <ResendButton subscriptionId={sub.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Recent failures (7 days)</h2>
          <Link href="/admin/deliveries?status=FAILED" className="text-xs text-accent">
            View all
          </Link>
        </div>
        {recentFailures.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-fg-muted">No failed deliveries this week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <tbody>
                {recentFailures.map((d) => (
                  <tr key={d.id}>
                    <td className="table-cell whitespace-nowrap text-xs text-fg-faint">{formatDateTime(d.createdAt)}</td>
                    <td className="table-cell">{d.to}</td>
                    <td className="table-cell">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="table-cell max-w-[360px] truncate text-xs text-fg-muted" title={d.error ?? ""}>
                      {d.error}
                    </td>
                    <td className="table-cell text-right">{d.subscriptionId && <ResendButton subscriptionId={d.subscriptionId} label="Retry" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
