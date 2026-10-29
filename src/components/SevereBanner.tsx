"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import type { Warning } from "@/lib/severe";

const STYLE: Record<Warning["level"], { box: string; text: string; label: string }> = {
  severe: { box: "border-[#ff5a5a]/50 bg-[#ff5a5a]/10", text: "text-[#ff8a8a]", label: "Severe warning" },
  warning: { box: "border-[#ff9a3c]/50 bg-[#ff9a3c]/10", text: "text-[#ffb36b]", label: "Warning" },
  watch: { box: "border-[#f5c542]/40 bg-[#f5c542]/10", text: "text-[#f5d36b]", label: "Watch" },
};

const ICON: Record<Warning["type"], IconName> = {
  thunderstorm: "storm",
  heavy_rain: "rain",
  downpour: "rain",
  strong_wind: "wind",
  cyclone: "cyclone",
};

/** Shows active thunderstorm / heavy-rain / wind / cyclone warnings for a place. */
export function SevereBanner({ lat, lon, compact = false }: { lat: number; lon: number; compact?: boolean }) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setWarnings([]);
    fetch(`/api/warnings?lat=${lat}&lon=${lon}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { warnings: [] }))
      .then((d) => setWarnings(d.warnings ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [lat, lon]);

  if (!warnings.length) return null;
  const shown = open || !compact ? warnings : warnings.slice(0, 1);

  return (
    <div className="grid gap-2" role="alert" aria-live="polite">
      {shown.map((w, i) => {
        const s = STYLE[w.level];
        return (
          <div key={`${w.type}-${i}`} className={`flex gap-3 rounded-xl border px-3.5 py-3 ${s.box}`}>
            <span className={`mt-0.5 shrink-0 ${s.text}`}>
              <Icon name={ICON[w.type]} size={compact ? 18 : 22} />
            </span>
            <div className="min-w-0">
              <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${s.text}`}>{s.label}</div>
              <div className={`font-semibold ${compact ? "text-sm text-white" : "text-base"}`}>{w.title}</div>
              <p className={`mt-0.5 text-sm ${compact ? "text-white/75" : "text-fg-muted"}`}>{compact ? w.message.split(". ")[0] + "." : w.message}</p>
              {w.link && !compact && (
                <a href={w.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent hover:underline">
                  Cyclone track & impact report (GDACS) →
                </a>
              )}
            </div>
          </div>
        );
      })}
      {compact && warnings.length > 1 && (
        <button onClick={() => setOpen((o) => !o)} className="text-left text-xs text-white/60 hover:text-white">
          {open ? "Show less" : `+${warnings.length - 1} more warning${warnings.length > 2 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
