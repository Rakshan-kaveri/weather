"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { timeAgo } from "@/lib/time";

const NAV: { href: string; label: string; icon: IconName; auth?: boolean }[] = [
  { href: "/", label: "Map", icon: "layers" },
  { href: "/dashboard", label: "My weather", icon: "sun" },
  { href: "/places", label: "Places", icon: "pin", auth: true },
  { href: "/compare", label: "Compare", icon: "compare" },
  { href: "/satellite-view", label: "Satellite View", icon: "satellite" },
  { href: "/subscriptions", label: "Reports", icon: "mail", auth: true },
  { href: "/alerts", label: "Alerts", icon: "bell", auth: true },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7cc4ff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill="url(#lg)" />
        <path d="M6 18c3-4 7-4 10 0s7 4 10 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M8 23c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0" stroke="#fff" strokeOpacity=".6" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="21" cy="10" r="3" fill="#FFD25A" />
      </svg>
      <span>SkyCast</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const onMap = pathname === "/";
  const signedIn = status === "authenticated";
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    setMobile(false);
    setMenu(false);
  }, [pathname]);

  return (
    <header
      className={
        onMap
          ? "pointer-events-none fixed inset-x-0 top-0 z-[1100] p-3"
          : "sticky top-0 z-[1100] border-b border-ink-700 bg-ink-950/85 backdrop-blur-xl"
      }
    >
      <div
        className={`pointer-events-auto mx-auto flex items-center gap-3 ${
          onMap ? "glass max-w-none rounded-2xl px-3 py-2" : "max-w-6xl px-4 py-3 sm:px-6"
        }`}
      >
        <Logo className={onMap ? "text-white" : ""} />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.filter((n) => !n.auth || signedIn).map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? onMap
                      ? "bg-white/15 text-white"
                      : "bg-ink-800 text-fg"
                    : onMap
                      ? "text-white/70 hover:bg-white/10 hover:text-white"
                      : "text-fg-muted hover:bg-ink-800 hover:text-fg"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm ${pathname.startsWith("/admin") ? "bg-accent/20 text-accent" : onMap ? "text-white/70 hover:text-white" : "text-fg-muted hover:text-fg"}`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn && <Bell onMap={onMap} />}
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
          ) : signedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full p-0.5 ring-1 ring-white/10 hover:ring-white/30"
                aria-haspopup="menu"
                aria-expanded={menu}
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
                    {session.user.name?.[0] ?? "U"}
                  </span>
                )}
              </button>
              {menu && (
                <div role="menu" className="glass absolute right-0 mt-2 w-56 overflow-hidden rounded-xl p-1 text-sm">
                  <div className="px-3 py-2">
                    <div className="font-medium text-white">{session.user.name}</div>
                    <div className="truncate text-xs text-white/60">{session.user.email}</div>
                  </div>
                  <div className="my-1 h-px bg-white/10" />
                  <MenuLink href="/settings" icon="settings" label="Settings" />
                  <MenuLink href="/subscriptions" icon="mail" label="Email & SMS reports" />
                  {isAdmin && <MenuLink href="/admin" icon="shield" label="Admin panel" />}
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-white/80 hover:bg-white/10"
                  >
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => signIn("google")} className="btn-primary py-1.5">
              <GoogleG /> Sign in
            </button>
          )}
          <button
            className={`grid h-9 w-9 place-items-center rounded-lg lg:hidden ${onMap ? "text-white hover:bg-white/10" : "hover:bg-ink-800"}`}
            onClick={() => setMobile((m) => !m)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="glass pointer-events-auto mx-3 mt-2 grid gap-1 rounded-2xl p-2 lg:hidden">
          {NAV.filter((n) => !n.auth || signedIn).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-white/85 hover:bg-white/10">
              <Icon name={n.icon} size={18} /> {n.label}
            </Link>
          ))}
          {signedIn && (
            <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-white/85 hover:bg-white/10">
              <Icon name="settings" size={18} /> Settings
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-white/85 hover:bg-white/10">
              <Icon name="shield" size={18} /> Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/80 hover:bg-white/10">
      <Icon name={icon} size={16} /> {label}
    </Link>
  );
}

export function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

type Note = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

function Bell({ onMap }: { onMap: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: Note[]; unread: number }>({ items: [], unread: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && data.unread) {
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() =>
        setData((d) => ({ ...d, unread: 0 })),
      );
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className={`relative grid h-9 w-9 place-items-center rounded-lg ${onMap ? "text-white hover:bg-white/10" : "text-fg-muted hover:bg-ink-800"}`}
        aria-label={`Notifications${data.unread ? ` (${data.unread} unread)` : ""}`}
      >
        <Icon name="bell" />
        {data.unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="glass absolute right-0 mt-2 w-80 rounded-xl p-1 text-sm">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/50">Notifications</div>
          {data.items.length === 0 ? (
            <div className="px-3 pb-4 text-white/60">No alerts yet. Set one up in Alerts.</div>
          ) : (
            <ul className="max-h-96 overflow-auto scrollbar-thin">
              {data.items.map((n) => (
                <li key={n.id}>
                  <a href={n.link ?? "#"} className="block rounded-lg px-3 py-2 hover:bg-white/10">
                    <div className="font-medium text-white">{n.title}</div>
                    <div className="text-white/65">{n.body}</div>
                    <div className="mt-0.5 text-[11px] text-white/40">{timeAgo(n.createdAt)}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
