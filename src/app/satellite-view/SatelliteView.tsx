"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { EmbedCheck } from "@/lib/zoomEarth";

/** Shown whenever the official site can't (or shouldn't) be embedded. */
function Fallback({ title, reason, url }: { title: string; reason: string; url: string }) {
  return (
    <div className="card mt-5 grid place-items-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Icon name="satellite" size={26} />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-fg-muted">{reason}</p>
      <p className="mt-1 max-w-lg text-sm text-fg-muted">Zoom Earth must be opened separately in its own tab.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Open Zoom Earth ↗
        </a>
        <Link href="/?layer=satellite" className="btn-ghost">
          Use SkyCast live satellite map
        </Link>
      </div>
    </div>
  );
}

export function SatelliteView({ enabled, check, url }: { enabled: boolean; check: EmbedCheck | null; url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (!enabled) {
    return (
      <Fallback
        title="Embedding is turned off"
        reason="Zoom Earth's terms of service don't say whether other websites may show it in a frame, so embedding stays disabled until permission is confirmed."
        url={url}
      />
    );
  }
  if (check?.status === "blocked") return <Fallback title="Zoom Earth can't be shown inside this page" reason={check.reason} url={url} />;
  if (offline) return <Fallback title="You appear to be offline" reason="Connect to the internet to load Zoom Earth." url={url} />;

  return (
    <div className="mt-5">
      <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-sm text-fg-muted" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg-faint/30 border-t-accent" />
              Loading Zoom Earth…
            </div>
          </div>
        )}
        <iframe
          src={url}
          title="Zoom Earth — external satellite and weather map"
          className="relative block h-[calc(100vh-220px)] min-h-[480px] w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="geolocation; fullscreen"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <p className="mt-2 text-xs text-fg-faint">
        {slow && !loaded ? "Still loading. " : ""}
        If the frame stays blank or shows an error, your browser blocked it. Use{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Open Zoom Earth
        </a>{" "}
        instead.
        {check?.status === "unknown" && ` (${check.reason})`}
      </p>
    </div>
  );
}
