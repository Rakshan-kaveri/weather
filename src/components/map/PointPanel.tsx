"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "../Icon";
import { WeatherIcon } from "../WeatherIcon";
import { usePrefs } from "../Providers";
import { api, toast } from "../Toast";
import { SevereBanner } from "../SevereBanner";
import { aqiLevel, compass, describe } from "@/lib/codes";
import { hourLabel, temp, wind } from "@/lib/units";
import type { AirQuality, Forecast } from "@/lib/weather";

type Point = { lat: number; lon: number; name?: string; region?: string; country?: string };

export function PointPanel({ point, onClose }: { point: Point; onClose: () => void }) {
  const { prefs } = usePrefs();
  const { status } = useSession();
  const [data, setData] = useState<{ forecast: Forecast; air: AirQuality | null } | null>(null);
  const [place, setPlace] = useState<{ name: string; region?: string; country?: string } | null>(
    point.name ? { name: point.name, region: point.region, country: point.country } : null,
  );
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(null);
    setError(false);
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${point.lat}&lon=${point.lon}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch((e) => e?.name !== "AbortError" && setError(true));
    if (!point.name) {
      setPlace(null);
      fetch(`/api/reverse?lat=${point.lat}&lon=${point.lon}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setPlace)
        .catch(() => {});
    } else setPlace({ name: point.name, region: point.region, country: point.country });
    return () => ctrl.abort();
  }, [point.lat, point.lon, point.name, point.region, point.country]);

  const name = place?.name ?? "Loading…";
  const c = data?.forecast.current;
  const nowIdx = data ? Math.max(0, data.forecast.hourly.findIndex((h) => h.time.slice(0, 13) === data.forecast.current.time.slice(0, 13))) : 0;
  const next = data?.forecast.hourly.slice(nowIdx, nowIdx + 12) ?? [];
  const aqi = aqiLevel(data?.air?.usAqi);
  const detailHref = `/w?lat=${point.lat.toFixed(3)}&lon=${point.lon.toFixed(3)}&name=${encodeURIComponent(place?.name ?? "")}`;

  const save = async () => {
    if (!place) return;
    setSaving(true);
    try {
      await api("/api/places", { method: "POST", json: { name: place.name, region: place.region, country: place.country, lat: point.lat, lon: point.lon } });
      toast(`${place.name} saved to your places`);
    } catch {
      /* toast shown */
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      className="glass absolute inset-x-3 bottom-[200px] z-[1001] max-h-[55vh] overflow-auto rounded-2xl p-4 scrollbar-thin sm:bottom-auto sm:left-3 sm:right-auto sm:top-[132px] sm:max-h-[calc(100vh-240px)] sm:w-[380px]"
      aria-label={`Weather at ${name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">{name}</h2>
          <p className="truncate text-xs text-white/55">
            {[place?.region, place?.country].filter(Boolean).join(", ") || `${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°`}
          </p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-[#ffb4b4]">Couldn&apos;t load weather for this spot. Try again in a moment.</p>}

      {!data && !error && (
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        </div>
      )}

      {c && data && (
        <>
          <div className="mt-3">
            <SevereBanner lat={point.lat} lon={point.lon} compact />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <WeatherIcon code={c.weatherCode} isDay={c.isDay} size={56} />
            <div>
              <div className="text-4xl font-light leading-none text-white">{temp(c.temperature, prefs.tempUnit)}</div>
              <div className="mt-1 text-sm text-white/75">
                {describe(c.weatherCode).label} · Feels {temp(c.feelsLike, prefs.tempUnit)}
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Wind" value={`${wind(c.windSpeed, prefs.windUnit)}`} sub={compass(c.windDirection)} />
            <Stat label="Humidity" value={`${Math.round(c.humidity)}%`} />
            <Stat label="Rain today" value={`${data.forecast.daily[0]?.precipProbMax ?? 0}%`} />
            <Stat label="Pressure" value={`${Math.round(c.pressure)}`} sub="hPa" />
            <Stat label="UV" value={c.uvIndex != null ? String(Math.round(c.uvIndex)) : "—"} />
            <Stat label="AQI" value={data.air?.usAqi != null ? String(Math.round(data.air.usAqi)) : "—"} sub={aqi.label} color={aqi.color} />
          </dl>

          <div className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {next.map((h) => (
              <div key={h.time} className="flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-white/85">
                <span className="text-[10px] text-white/55">{hourLabel(h.time, prefs.timeFormat)}</span>
                <WeatherIcon code={h.weatherCode} isDay={h.isDay} size={26} />
                <span className="text-xs font-medium">{temp(h.temperature, prefs.tempUnit)}</span>
                <span className="text-[10px] text-[#7fc2ff]">{h.precipProb ? `${h.precipProb}%` : ""}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={detailHref} className="btn-primary flex-1">
              Full forecast <Icon name="arrow" size={15} />
            </Link>
            {status === "authenticated" && (
              <button onClick={save} disabled={saving || !place} className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Icon name="star" size={15} /> Save
              </button>
            )}
            <Link
              href={status === "authenticated" ? `/subscriptions?lat=${point.lat.toFixed(3)}&lon=${point.lon.toFixed(3)}&name=${encodeURIComponent(place?.name ?? "")}` : "/login?next=/subscriptions"}
              className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10"
              title="Get a daily weather report for this place"
            >
              <Icon name="mail" size={15} /> Daily report
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-white/50">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-white" style={color ? { color } : undefined}>
        {value}
      </dd>
      {sub && <dd className="truncate text-[10px] text-white/50">{sub}</dd>}
    </div>
  );
}
