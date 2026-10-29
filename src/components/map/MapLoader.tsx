"use client";

import dynamic from "next/dynamic";

// Leaflet needs `window`, so the map only renders in the browser.
const MapExplorer = dynamic(() => import("./MapExplorer"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#05070c] text-sm text-white/60">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#4ea8ff]" />
        Loading live map…
      </div>
    </div>
  ),
});

export function MapLoader() {
  return <MapExplorer />;
}
