"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/deliveries", label: "Delivery log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">Admin</div>
        <h1 className="h1">Control room</h1>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-900 p-1" aria-label="Admin sections">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "text-fg-muted hover:bg-ink-800 hover:text-fg"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
