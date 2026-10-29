"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchBox } from "@/components/map/SearchBox";
import { Icon } from "@/components/Icon";
import { WeatherIcon } from "@/components/WeatherIcon";
import { usePrefs } from "@/components/Providers";
import { api, toast } from "@/components/Toast";
import { describe } from "@/lib/codes";
import { temp } from "@/lib/units";

type Place = { id: string; name: string; region: string | null; country: string | null; lat: number; lon: number; isDefault: boolean };
type Now = { temperature: number; weatherCode: number; isDay: boolean; max: number; min: number; rain: number };

export function PlacesManager({ initial }: { initial: Place[] }) {
  const [places, setPlaces] = useState<Place[]>(initial);
  const [now, setNow] = useState<Record<string, Now>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { prefs } = usePrefs();

  useEffect(() => {
    places.forEach((p) => {
      if (now[p.id]) return;
      fetch(`/api/weather?lat=${p.lat}&lon=${p.lon}`)
        .then((r) => r.json())
        .then((d) => {
          const c = d.forecast.current;
          const t = d.forecast.daily[0];
          setNow((n) => ({ ...n, [p.id]: { temperature: c.temperature, weatherCode: c.weatherCode, isDay: c.isDay, max: t.tempMax, min: t.tempMin, rain: t.precipProbMax } }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  const add = async (p: { lat: number; lon: number; name: string; region?: string; country?: string }) => {
    const { place } = await api<{ place: Place }>("/api/places", { method: "POST", json: p });
    setPlaces((ps) => (place.isDefault ? [place, ...ps.map((x) => ({ ...x, isDefault: false }))] : [...ps, place]));
    toast(`${place.name} added`);
  };

  const makeDefault = async (id: string) => {
    await api(`/api/places/${id}`, { method: "PATCH", json: { isDefault: true } });
    setPlaces((ps) => ps.map((p) => ({ ...p, isDefault: p.id === id })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
  };

  const rename = async (id: string) => {
    if (!draft.trim()) return;
    await api(`/api/places/${id}`, { method: "PATCH", json: { name: draft.trim() } });
    setPlaces((ps) => ps.map((p) => (p.id === id ? { ...p, name: draft.trim() } : p)));
    setEditing(null);
  };

  const remove = async (id: string) => {
    await api(`/api/places/${id}`, { method: "DELETE" });
    setPlaces((ps) => {
      const left = ps.filter((p) => p.id !== id);
      if (left.length && !left.some((p) => p.isDefault)) left[0] = { ...left[0], isDefault: true };
      return left;
    });
  };

  return (
    <div className="mt-6 grid gap-5">
      <div className="max-w-md">
        <label className="label">Add a place</label>
        <SearchBox variant="plain" onPick={(p) => add(p).catch(() => {})} placeholder="Search a city, town or village" />
      </div>

      {places.length === 0 ? (
        <div className="card p-8 text-center text-sm text-fg-muted">
          <Icon name="pin" size={28} className="mx-auto mb-2 text-fg-faint" />
          No saved places yet. Search above, or tap <span className="font-medium text-fg">Save</span> on any spot on the map.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((p) => {
            const n = now[p.id];
            return (
              <li key={p.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {editing === p.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          rename(p.id).catch(() => {});
                        }}
                        className="flex gap-2"
                      >
                        <input className="input py-1" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus maxLength={80} aria-label="Place name" />
                        <button className="btn-primary px-2 py-1" aria-label="Save name">
                          <Icon name="check" size={14} />
                        </button>
                      </form>
                    ) : (
                      <button
                        className="truncate text-left text-base font-semibold hover:underline"
                        onClick={() => {
                          setEditing(p.id);
                          setDraft(p.name);
                        }}
                        title="Rename"
                      >
                        {p.name}
                      </button>
                    )}
                    <p className="truncate text-xs text-fg-faint">{[p.region, p.country].filter(Boolean).join(", ") || `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`}</p>
                  </div>
                  {p.isDefault ? (
                    <span className="chip bg-accent/15 text-accent">Default</span>
                  ) : (
                    <button className="text-xs text-fg-faint hover:text-accent" onClick={() => makeDefault(p.id).catch(() => {})}>
                      Make default
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {n ? (
                    <>
                      <WeatherIcon code={n.weatherCode} isDay={n.isDay} size={44} />
                      <div>
                        <div className="text-2xl font-light">{temp(n.temperature, prefs.tempUnit)}</div>
                        <div className="text-xs text-fg-muted">
                          {describe(n.weatherCode).label} · H {temp(n.max, prefs.tempUnit)} L {temp(n.min, prefs.tempUnit)} · {n.rain}% rain
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-11 w-full animate-pulse rounded-lg bg-ink-800" />
                  )}
                </div>
                <div className="mt-4 flex gap-2 border-t border-ink-700 pt-3 text-sm">
                  <Link className="btn-ghost flex-1 py-1.5" href={`/w?lat=${p.lat}&lon=${p.lon}&name=${encodeURIComponent(p.name)}`}>
                    Forecast
                  </Link>
                  <Link className="btn-ghost py-1.5" href={`/subscriptions?lat=${p.lat}&lon=${p.lon}&name=${encodeURIComponent(p.name)}`} title="Daily report">
                    <Icon name="mail" size={15} />
                  </Link>
                  <button className="btn-danger py-1.5" onClick={() => remove(p.id).catch(() => {})} aria-label={`Delete ${p.name}`}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
