"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ForecastView, type Loc } from "@/components/forecast/ForecastView";
import { SearchBox } from "@/components/map/SearchBox";
import { Icon } from "@/components/Icon";

type SavedPlace = Loc & { id: string; isDefault: boolean };

export function Dashboard({
  signedIn,
  firstName,
  places,
  zoomEarth = false,
}: {
  signedIn: boolean;
  firstName: string | null;
  places: SavedPlace[];
  zoomEarth?: boolean;
}) {
  const defaultPlace = places.find((p) => p.isDefault) ?? places[0] ?? null;
  const [loc, setLoc] = useState<Loc | null>(defaultPlace);
  const [activeId, setActiveId] = useState<string | "here" | null>(
    defaultPlace?.id ?? null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(
        "Your browser doesn't support location. Search for a place instead.",
      );
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1000) / 1000;
        const lon = Math.round(pos.coords.longitude * 1000) / 1000;
        let name = "My location";
        let region: string | undefined;
        let country: string | undefined;
        try {
          const r = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`).then(
            (r) => r.json(),
          );
          name = r.name ?? name;
          region = r.region;
          country = r.country;
        } catch {
          /* keep default name */
        }
        setLoc({ lat, lon, name, region, country });
        setActiveId("here");
        setLocating(false);
        if (signedIn) {
          fetch("/api/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lon }),
          }).catch(() => {});
        }
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked. Search for your town instead."
            : "Couldn't get your location. Try searching instead.",
        );
      },
      { timeout: 10000, maximumAge: 5 * 60_000 },
    );
  };

  // No saved default → try the device location straight away.
  useEffect(() => {
    if (!defaultPlace) useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="h1">Your weather</h1>
          {zoomEarth && (
            <nav
              className="mt-3 inline-flex rounded-lg border border-ink-700 bg-ink-900 p-1 text-sm"
              aria-label="Dashboard views"
            >
              <span
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-white"
                aria-current="page"
              >
                Forecast
              </span>
              <Link
                href="/satellite-view"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-fg-muted hover:text-fg"
              >
                <Icon name="satellite" size={14} /> Satellite View
              </Link>
            </nav>
          )}
        </div>
        <div className="w-full sm:w-80">
          <SearchBox
            variant="plain"
            placeholder="Check another place…"
            onPick={(p) => {
              setLoc(p);
              setActiveId(null);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={useMyLocation}
          className={`chip h-8 cursor-pointer px-3 text-xs normal-case tracking-normal ${activeId === "here" ? "bg-accent text-white" : "border border-ink-700 bg-ink-800 text-fg-muted hover:text-fg"}`}
        >
          <Icon name="locate" size={14} />{" "}
          {locating ? "Locating…" : "My location"}
        </button>
        {places.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setLoc(p);
              setActiveId(p.id);
            }}
            className={`chip h-8 cursor-pointer px-3 text-xs normal-case tracking-normal ${activeId === p.id ? "bg-accent text-white" : "border border-ink-700 bg-ink-800 text-fg-muted hover:text-fg"}`}
          >
            {p.isDefault && <Icon name="star" size={12} />} {p.name}
          </button>
        ))}
        {signedIn ? (
          <Link href="/places" className="text-xs text-accent hover:underline">
            Manage places
          </Link>
        ) : (
          <Link
            href="/login?next=/dashboard"
            className="text-xs text-accent hover:underline"
          >
            Sign in to save places
          </Link>
        )}
      </div>

      {geoError && !loc && (
        <div className="card p-6 text-sm text-fg-muted">{geoError}</div>
      )}
      {loc ? (
        <ForecastView loc={loc} />
      ) : (
        !geoError && <div className="card h-64 animate-pulse" />
      )}
    </div>
  );
}
