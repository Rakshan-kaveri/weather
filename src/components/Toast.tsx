"use client";

import { useEffect, useState } from "react";

type T = { id: number; text: string; kind: "ok" | "error" };
let push: ((t: Omit<T, "id">) => void) | null = null;

export function toast(text: string, kind: T["kind"] = "ok") {
  push?.({ text, kind });
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { ...t, id }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[2000] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`glass pointer-events-auto rounded-xl px-4 py-2.5 text-sm ${t.kind === "error" ? "border-bad/50 text-[#ffb4b4]" : ""}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** fetch wrapper that shows API errors as toasts. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string; issues?: string[] }).issues?.join(", ") || (data as { error?: string }).error || `Request failed (${res.status})`;
    toast(msg, "error");
    throw new Error(msg);
  }
  return data as T;
}
