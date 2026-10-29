"use client";

import { useEffect, useState } from "react";
import { SearchBox } from "@/components/map/SearchBox";
import { WeatherIcon } from "@/components/WeatherIcon";
import { usePrefs } from "@/components/Providers";
import { aqiLevel, compass, describe } from "@/lib/codes";
import { dayName, temp, wind } from "@/lib/units";
import type { AirQuality, Forecast } from "@/lib/weather";

type P = { name: string; lat: number; lon: number; region?: string | null; country?: string | null };
type D = { forecast: Forecast; air: AirQuality | null };

const DEFAULTS: P[] = [
  { name: "Manipal", lat: 13.35, lon: 74.79, region: "Karnataka", country: "India" },
  { name: "Bengaluru", lat: 12.97, lon: 77.59, region: "Karnataka", country: "India" },
];

export function Compare({ saved }: { saved: P[] }) {
  const [a, setA] = useState<P>(saved[0] ?? DEFAULTS[0]);
  const [b, setB] = useState<P>(saved[1] ?? DEFAULTS[1]);
  const [da, setDa] = useState<D | null>(null);
  const [db, setDb] = useState<D | null>(null);
  const { prefs } = usePrefs();

  useEffect(() => {
    setDa(null);
    fetch(`/api/weather?lat=${a.lat}&lon=${a.lon}`).then((r) => r.json()).then(setDa).catch(() => {});
  }, [a]);
  useEffect(() => {
    setDb(null);
    fetch(`/api/weather?lat=${b.lat}&lon=${b.lon}`).then((r) => r.json()).then(setDb).catch(() => {});
  }, [b]);

  const rows: { label: string; get: (d: D) => string; better?: (x: D, y: D) => number }[] = [
    { label: "Temperature", get: (d) => temp(d.forecast.current.temperature, prefs.tempUnit) },
    { label: "Feels like", get: (d) => temp(d.forecast.current.feelsLike, prefs.tempUnit) },
    { label: "Conditions", get: (d) => describe(d.forecast.current.weatherCode).label },
    { label: "Today high / low", get: (d) => `${temp(d.forecast.daily[0].tempMax, prefs.tempUnit)} / ${temp(d.forecast.daily[0].tempMin, prefs.tempUnit)}` },
    { label: "Rain chance today", get: (d) => `${d.forecast.daily[0].precipProbMax}%`, better: (x, y) => y.forecast.daily[0].precipProbMax - x.forecast.daily[0].precipProbMax },
    { label: "Rain total today", get: (d) => `${d.forecast.daily[0].precipSum.toFixed(1)} mm` },
    { label: "Wind", get: (d) => `${wind(d.forecast.current.windSpeed, prefs.windUnit)} ${compass(d.forecast.current.windDirection)}` },
    { label: "Humidity", get: (d) => `${Math.round(d.forecast.current.humidity)}%` },
    { label: "UV index", get: (d) => (d.forecast.current.uvIndex != null ? String(Math.round(d.forecast.current.uvIndex)) : "—") },
    {
      label: "Air quality",
      get: (d) => (d.air?.usAqi != null ? `${Math.round(d.air.usAqi)} · ${aqiLevel(d.air.usAqi).label}` : "—"),
      better: (x, y) => (y.air?.usAqi ?? 0) - (x.air?.usAqi ?? 0),
    },
    { label: "Tomorrow", get: (d) => `${describe(d.forecast.daily[1].weatherCode).label}, ${temp(d.forecast.daily[1].tempMax, prefs.tempUnit)}` },
  ];

  const options = [...saved, ...DEFAULTS.filter((d) => !saved.some((s) => s.name === d.name))];

  return (
    <div className="mt-6 grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { p: a, set: setA, label: "Place A" },
          { p: b, set: setB, label: "Place B" },
        ].map(({ p, set, label }) => (
          <div key={label} className="card p-4">
            <div className="label">{label}</div>
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="mb-3 text-xs text-fg-faint">{[p.region, p.country].filter(Boolean).join(", ")}</div>
            <SearchBox variant="plain" onPick={(x) => set(x)} placeholder="Change place…" />
            {options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.slice(0, 6).map((o) => (
                  <button key={o.name + o.lat} onClick={() => set(o)} className="chip border border-ink-700 bg-ink-800 normal-case tracking-normal text-fg-muted hover:text-fg">
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className="table-head w-1/3"> </th>
              <th className="table-head">
                <div className="flex items-center gap-2">
                  {da && <WeatherIcon code={da.forecast.current.weatherCode} isDay={da.forecast.current.isDay} size={28} />}
                  <span className="text-sm normal-case tracking-normal text-fg">{a.name}</span>
                </div>
              </th>
              <th className="table-head">
                <div className="flex items-center gap-2">
                  {db && <WeatherIcon code={db.forecast.current.weatherCode} isDay={db.forecast.current.isDay} size={28} />}
                  <span className="text-sm normal-case tracking-normal text-fg">{b.name}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cmp = da && db && r.better ? r.better(da, db) : 0;
              return (
                <tr key={r.label}>
                  <td className="table-cell text-fg-muted">{r.label}</td>
                  <td className={`table-cell font-medium ${cmp > 0 ? "text-good" : ""}`}>{da ? r.get(da) : "…"}</td>
                  <td className={`table-cell font-medium ${cmp < 0 ? "text-good" : ""}`}>{db ? r.get(db) : "…"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {da && db && (
        <div className="card overflow-x-auto p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">Week ahead</h2>
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {da.forecast.daily.slice(0, 7).map((d, i) => {
                const e = db.forecast.daily[i];
                return (
                  <tr key={d.date}>
                    <td className="table-cell w-24 text-fg-muted">{i === 0 ? "Today" : dayName(d.date)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <WeatherIcon code={d.weatherCode} size={24} /> {temp(d.tempMax, prefs.tempUnit)} / {temp(d.tempMin, prefs.tempUnit)}
                        <span className="text-xs text-accent">{d.precipProbMax}%</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      {e && (
                        <div className="flex items-center gap-2">
                          <WeatherIcon code={e.weatherCode} size={24} /> {temp(e.tempMax, prefs.tempUnit)} / {temp(e.tempMin, prefs.tempUnit)}
                          <span className="text-xs text-accent">{e.precipProbMax}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
