import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { UserActions } from "../AdminActions";

export const metadata = { title: "Users · Admin" };

type Props = { searchParams: Promise<{ q?: string; filter?: string }> };

export default async function AdminUsers({ searchParams }: Props) {
  const admin = await requireAdmin();
  const { q = "", filter = "all" } = await searchParams;
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { lastCity: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filter === "subscribed" ? { subscriptions: { some: { active: true } } } : {}),
    ...(filter === "blocked" ? { blocked: true } : {}),
    ...(filter === "admins" ? { role: "ADMIN" as const } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    include: {
      subscriptions: {
        select: {
          id: true,
          channel: true,
          active: true,
          deliveries: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true, error: true } },
        },
      },
      _count: { select: { places: true, alerts: true } },
    },
  });

  const filters = [
    { id: "all", label: "All" },
    { id: "subscribed", label: "With reports" },
    { id: "admins", label: "Admins" },
    { id: "blocked", label: "Blocked" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex w-full max-w-sm gap-2" action="/admin/users">
          <input name="q" defaultValue={q} className="input" placeholder="Search name, email or city" aria-label="Search users" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <button className="btn-ghost">Search</button>
        </form>
        <div className="flex gap-1">
          {filters.map((f) => (
            <Link
              key={f.id}
              href={`/admin/users?filter=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${filter === f.id ? "bg-ink-700 text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr>
              <th className="table-head">User</th>
              <th className="table-head">Last signed in</th>
              <th className="table-head">Last location</th>
              <th className="table-head">Email report</th>
              <th className="table-head">SMS report</th>
              <th className="table-head">Last delivery</th>
              <th className="table-head">Places / alerts</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="table-cell py-8 text-center text-fg-muted">
                  No users match.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const email = u.subscriptions.filter((s) => s.channel === "EMAIL");
              const sms = u.subscriptions.filter((s) => s.channel === "SMS");
              const last = u.subscriptions
                .flatMap((s) => s.deliveries)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
              return (
                <tr key={u.id} className={u.blocked ? "opacity-60" : ""}>
                  <td className="table-cell">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:underline">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs">{u.name?.[0] ?? "?"}</span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {u.name ?? "—"} {u.role === "ADMIN" && <StatusBadge status="ADMIN" />} {u.blocked && <StatusBadge status="BLOCKED" />}
                        </span>
                        <span className="block text-xs text-fg-faint">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="table-cell whitespace-nowrap">
                    <div>{timeAgo(u.lastLoginAt)}</div>
                    <div className="text-xs text-fg-faint">seen {timeAgo(u.lastSeenAt)}</div>
                  </td>
                  <td className="table-cell">
                    {u.lastCity || u.lastCountry ? (
                      <>
                        <div>{[u.lastCity, u.lastRegion].filter(Boolean).join(", ")}</div>
                        <div className="text-xs text-fg-faint">
                          {u.lastCountry} · {u.lastLocationSrc === "gps" ? "device" : "network"}
                        </div>
                      </>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                  <td className="table-cell">{email.length ? <StatusBadge status={email.some((s) => s.active) ? "ACTIVE" : "PAUSED"} title={`${email.length} report(s)`} /> : <span className="text-fg-faint">No</span>}</td>
                  <td className="table-cell">{sms.length ? <StatusBadge status={sms.some((s) => s.active) ? "ACTIVE" : "PAUSED"} title={`${sms.length} report(s)`} /> : <span className="text-fg-faint">No</span>}</td>
                  <td className="table-cell">
                    {last ? (
                      <div className="flex items-center gap-2" title={last.error ?? ""}>
                        <StatusBadge status={last.status} />
                        <span className="text-xs text-fg-faint">{timeAgo(last.createdAt)}</span>
                      </div>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                  <td className="table-cell text-fg-muted">
                    {u._count.places} / {u._count.alerts}
                  </td>
                  <td className="table-cell">
                    <UserActions id={u.id} blocked={u.blocked} role={u.role} self={u.id === admin.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fg-faint">Location is approximate (city level), taken from the network address at sign-in or from the device when the user taps “My location”.</p>
    </div>
  );
}
