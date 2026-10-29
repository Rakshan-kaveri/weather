import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { PreviewButton, ResendButton, SubToggle, UserActions } from "../../AdminActions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetail({ params }: Props) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      logins: { orderBy: { at: "desc" }, take: 15 },
      places: { orderBy: { createdAt: "asc" } },
      alerts: { orderBy: { createdAt: "asc" } },
      subscriptions: { include: { deliveries: { orderBy: { createdAt: "desc" }, take: 10 } } },
    },
  });
  if (!user) notFound();

  return (
    <div className="grid gap-5">
      <Link href="/admin/users" className="text-sm text-accent">
        ← All users
      </Link>
      <section className="card flex flex-wrap items-center gap-4 p-5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-14 w-14 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ink-700 text-lg">{user.name?.[0] ?? "?"}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">
            {user.name} {user.role === "ADMIN" && <StatusBadge status="ADMIN" />} {user.blocked && <StatusBadge status="BLOCKED" />}
          </h2>
          <div className="text-sm text-fg-muted">
            {user.email} {user.phone && `· ${user.phone}`}
          </div>
          <div className="mt-1 text-xs text-fg-faint">
            Joined {formatDateTime(user.createdAt)} · Last sign-in {timeAgo(user.lastLoginAt)} · Last seen {timeAgo(user.lastSeenAt)}
          </div>
        </div>
        <UserActions id={user.id} blocked={user.blocked} role={user.role} self={user.id === admin.id} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h3 className="p-5 pb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">Sign-in history</h3>
          {user.logins.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-fg-muted">No sign-ins recorded yet.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {user.logins.map((l) => (
                  <tr key={l.id}>
                    <td className="table-cell whitespace-nowrap text-xs text-fg-faint">{formatDateTime(l.at)}</td>
                    <td className="table-cell">
                      {[l.city, l.region, l.country].filter(Boolean).join(", ") || "Unknown"}
                      <div className="text-xs text-fg-faint">
                        {l.source === "gps" ? "device location" : "network location"}
                        {l.lat != null && l.lon != null && ` · ${l.lat.toFixed(2)}, ${l.lon.toFixed(2)}`}
                      </div>
                    </td>
                    <td className="table-cell max-w-[180px] truncate text-xs text-fg-faint" title={l.userAgent ?? ""}>
                      {l.ip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Places & alerts</h3>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {user.places.map((p) => (
              <li key={p.id} className="chip border border-ink-700 bg-ink-800 normal-case tracking-normal text-fg-muted">
                {p.isDefault && "★ "}
                {p.name}
              </li>
            ))}
            {user.places.length === 0 && <li className="text-sm text-fg-faint">No saved places</li>}
          </ul>
          <ul className="mt-4 space-y-1 text-sm">
            {user.alerts.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>
                  {a.metric} {a.operator === "gt" ? ">" : "<"} {a.threshold} · {a.day} · {a.placeName}
                </span>
                <StatusBadge status={a.active ? "ACTIVE" : "PAUSED"} />
              </li>
            ))}
            {user.alerts.length === 0 && <li className="text-fg-faint">No alerts</li>}
          </ul>
        </section>
      </div>

      <section className="grid gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Reports & deliveries</h3>
        {user.subscriptions.length === 0 && <div className="card p-5 text-sm text-fg-muted">Not signed up for email or SMS reports.</div>}
        {user.subscriptions.map((s) => (
          <div key={s.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">
                  {s.channel} · {s.placeName} <StatusBadge status={s.active ? "ACTIVE" : "PAUSED"} />
                </div>
                <div className="text-xs text-fg-faint">
                  {s.channel === "EMAIL" ? s.email : s.phone} · {s.sendTime} {s.timezone} · {s.forecastDay} · {s.language}
                  {s.farmerTips && " · farmer"}
                </div>
              </div>
              <div className="flex gap-2">
                <PreviewButton subscriptionId={s.id} />
                <ResendButton subscriptionId={s.id} />
                <SubToggle id={s.id} active={s.active} />
              </div>
            </div>
            <table className="w-full">
              <tbody>
                {s.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="table-cell whitespace-nowrap text-xs text-fg-faint">{formatDateTime(d.createdAt)}</td>
                    <td className="table-cell text-xs">{d.kind.split(":")[0]}</td>
                    <td className="table-cell">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="table-cell text-xs text-fg-faint">
                      {d.deliveredAt ? `delivered ${formatDateTime(d.deliveredAt)}` : ""} {d.openedAt ? `· opened ${formatDateTime(d.openedAt)}` : ""}
                    </td>
                    <td className="table-cell max-w-[280px] truncate text-xs text-bad" title={d.error ?? ""}>
                      {d.error}
                    </td>
                  </tr>
                ))}
                {s.deliveries.length === 0 && (
                  <tr>
                    <td className="table-cell text-sm text-fg-faint">Nothing sent yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
