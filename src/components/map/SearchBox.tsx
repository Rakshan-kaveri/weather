"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import type { GeoResult } from "@/lib/weather";

export type PickedPlace = { lat: number; lon: number; name: string; region?: string; country?: string };

export function SearchBox({
  onPick,
  placeholder = "Search city, town or village",
  variant = "glass",
}: {
  onPick: (p: PickedPlace) => void;
  placeholder?: string;
  variant?: "glass" | "plain";
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const d = await r.json();
        setResults(d.results ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (r: GeoResult) => {
    onPick({ lat: r.lat, lon: r.lon, name: r.name, region: r.admin1, country: r.country });
    setQ("");
    setOpen(false);
  };

  const glass = variant === "glass";

  return (
    <div className="relative" ref={box}>
      <div className={`flex h-11 items-center gap-2 rounded-xl px-3 ${glass ? "glass" : "border border-ink-700 bg-ink-800"}`}>
        <Icon name="search" size={17} className={glass ? "text-white/60" : "text-fg-faint"} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className={`h-full w-full bg-transparent text-sm outline-none ${glass ? "text-white placeholder:text-white/50" : "text-fg placeholder:text-fg-faint"}`}
          aria-label="Search places"
          role="combobox"
          aria-expanded={open}
          aria-controls="place-results"
          aria-autocomplete="list"
        />
        {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-accent" />}
      </div>
      {open && (
        <ul
          id="place-results"
          role="listbox"
          className={`absolute z-[1200] mt-2 max-h-80 w-full overflow-auto rounded-xl p-1 scrollbar-thin ${glass ? "glass" : "border border-ink-700 bg-ink-900 shadow-xl"}`}
        >
          {results.length === 0 ? (
            <li className={`px-3 py-2 text-sm ${glass ? "text-white/60" : "text-fg-muted"}`}>No places found</li>
          ) : (
            results.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    i === active ? (glass ? "bg-white/10" : "bg-ink-800") : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${glass ? "text-white" : "text-fg"}`}>{r.name}</span>
                    <span className={`block truncate text-xs ${glass ? "text-white/55" : "text-fg-faint"}`}>
                      {[r.admin2, r.admin1, r.country].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  {r.countryCode && <span className={`text-[10px] font-semibold ${glass ? "text-white/40" : "text-fg-faint"}`}>{r.countryCode}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
