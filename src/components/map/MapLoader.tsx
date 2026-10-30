"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

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

/** If anything inside the map throws, show a way back instead of a frozen screen. */
class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[map]", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#05070c] text-sm text-white/70">
        <div className="text-center">
          <p>The map hit a problem.</p>
          <button className="mt-3 rounded-lg bg-[#2f6bff] px-4 py-2 font-medium text-white" onClick={() => location.reload()}>
            Reload map
          </button>
        </div>
      </div>
    );
  }
}

export function MapLoader() {
  return (
    <MapErrorBoundary>
      <MapExplorer />
    </MapErrorBoundary>
  );
}
