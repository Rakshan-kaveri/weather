import type { Metadata } from "next";
import { checkZoomEarthEmbeddable, zoomEarthEmbedEnabled, ZOOM_EARTH_URL } from "@/lib/zoomEarth";
import { SatelliteView } from "./SatelliteView";

export const metadata: Metadata = { title: "Satellite View" };

export default async function SatelliteViewPage() {
  const enabled = zoomEarthEmbedEnabled();
  const check = enabled ? await checkZoomEarthEmbeddable() : null;
  return (
    <div className="page max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="h1">Satellite View</h1>
            <span className="chip border border-ink-600 bg-ink-800 text-fg-muted">External service</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Explore satellite imagery and weather conditions using Zoom Earth&apos;s official website.
          </p>
          <p className="mt-0.5 text-xs text-fg-faint">
            Zoom Earth is an independent website and is not part of SkyCast. Our own live map, forecasts and search stay available from the
            menu.
          </p>
        </div>
        <a href={ZOOM_EARTH_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
          Open Zoom Earth ↗
        </a>
      </div>
      <SatelliteView enabled={enabled} check={check} url={ZOOM_EARTH_URL} />
    </div>
  );
}
