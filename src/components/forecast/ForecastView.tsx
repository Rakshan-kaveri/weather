"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "../Icon";
import { WeatherIcon } from "../WeatherIcon";
import { usePrefs } from "../Providers";
import { api, toast } from "../Toast";
import { aqiLevel, compass, describe, uvLevel } from "@/lib/codes";
import { clock, dateLabel, dayName, hourLabel, rainWindow, shortDate, temp, wind } from "@/lib/units";
import type { AirQuality, Forecast, HistoryDay } from "@/lib/weather";
import { SevereBanner } from "../SevereBanner";

// The chart library is the heaviest part of this page; load it after the forecast itself is on screen.
const chartFallback = () => <div className="mt-4 h-56 w-full animate-pulse rounded-xl bg-ink-800/40" />;
const HourlyChart = dynamic(() => import("./Charts").then((m) => m.HourlyChart), { ssr: false, loading: chartFallback });
const HistoryChart = dynamic(() => import("./Charts").then((m) => m.HistoryChart), { ssr: false, loading: chartFallback });

export type Loc = { lat: number; lon: number; name: string; region?: string | null; country?: string | null };

export function ForecastView({ loc, compact = false }: { loc: Loc; compact?: boolean }) {
  const { prefs } = usePrefs();
  const { status } = useSession();
  const [data, setData] = useState<{ forecast: Forecast; air: AirQuality | null } | null>(null);
  const [history, setHistory] = useState<HistoryDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`, { signal: ctrl.signal })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d) => {
        setData(d);
        try {
          localStorage.setItem(`skycast:last:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`, JSON.stringify(d));
        } catch {
          /* ignore */
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        // Offline? Show the last data we saw for this place.
        try {
          const cached = localStorage.getItem(`skycast:last:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`);
          if (cached) {
            setData(JSON.parse(cached));
            setError("You're offline — showing the last forecast we loaded.");
            return;
          }
        } catch {
          /* ignore */
        }
        setError("Couldn't load the forecast. Check your connection and try again.");
      });
    if (!compact) {
      fetch(`/api/history?lat=${loc.lat}&lon=${loc.lon}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setHistory(d.days ?? null))
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [loc.lat, loc.lon, compact]);

  const save = async () => {
    try {
      await api("/api/places", { method: "POST", json: { name: loc.name, region: loc.region, country: loc.country, lat: loc.lat, lon: loc.lon } });
      toast(`${loc.name} saved to your places`);
    } catch {
      /* toast shown */
    }
  };

  if (!data) {
    return error ? (
      <div className="card p-6 text-sm text-bad">{error}</div>
    ) : (
      <div className="grid gap-4">
        <div className="card h-48 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  const { forecast: f, air } = data;
  const c = f.current;
  const today = f.daily[0];
  const tomorrow = f.daily[1];
  const nowIdx = Math.max(0, f.hourly.findIndex((h) => h.time.slice(0, 13) === c.time.slice(0, 13)));
  const next48 = f.hourly.slice(nowIdx, nowIdx + 48);
  const aq = aqiLevel(air?.usAqi);
  // Tomorrow: when the rain is expected, and a plain-language label for "sunny with a brief shower" days
  const tmrHours = tomorrow ? f.hourly.filter((h) => h.time.startsWith(tomorrow.date)) : [];
  const tmrRain = rainWindow(tmrHours);
  const tmrDayCloud = tmrHours.filter((h) => +h.time.slice(11, 13) >= 8 && +h.time.slice(11, 13) <= 17).reduce((a, h, _, arr) => a + h.cloudCover / arr.length, 0);
  const tmrLabel =
    tomorrow && tomorrow.weatherCode === 80 && tomorrow.precipSum < 2.5 && tmrDayCloud < 60
      ? `Mostly sunny, brief shower${tmrRain ? ` ${tmrRain}` : ""}`
      : tomorrow
        ? describe(tomorrow.weatherCode).label
        : "";
  const mapHref = `/?lat=${loc.lat}&lon=${loc.lon}&name=${encodeURIComponent(loc.name)}`;
  const q = `lat=${loc.lat}&lon=${loc.lon}&name=${encodeURIComponent(loc.name)}`;

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">{error}</div>}
      <SevereBanner lat={loc.lat} lon={loc.lon} />

      {/* Now */}
      <section className="card overflow-hidden" aria-labelledby="now-h">
        <div className="relative p-5 sm:p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background: c.isDay
                ? "radial-gradient(1000px 300px at 10% -20%, rgba(78,168,255,0.25), transparent 60%)"
                : "radial-gradient(1000px 300px at 10% -20%, rgba(120,110,255,0.22), transparent 60%)",
            }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-fg-faint" id="now-h">
                Now · {clock(c.time, prefs.timeFormat)} local time
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{loc.name}</h1>
              <p className="text-sm text-fg-muted">{[loc.region, loc.country].filter(Boolean).join(", ")}</p>
              <div className="mt-4 flex items-center gap-4">
                <WeatherIcon code={c.weatherCode} isDay={c.isDay} size={72} />
                <div>
                  <div className="text-6xl font-extralight leading-none tracking-tight">{temp(c.temperature, prefs.tempUnit)}</div>
                  <div className="mt-2 text-fg-muted">
                    {describe(c.weatherCode).label} · Feels like {temp(c.feelsLike, prefs.tempUnit)}
                  </div>
                  <div className="text-sm text-fg-faint">
                    H {temp(today.tempMax, prefs.tempUnit)} · L {temp(today.tempMin, prefs.tempUnit)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={mapHref} className="btn-ghost">
                <Icon name="layers" size={16} /> View on map
              </Link>
              {status === "authenticated" && (
                <>
                  <button onClick={save} className="btn-ghost">
                    <Icon name="star" size={16} /> Save place
                  </button>
                  <Link href={`/subscriptions?${q}`} className="btn-primary">
                    <Icon name="mail" size={16} /> Daily report
                  </Link>
                </>
              )}
            </div>
          </div>

          <dl className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Metric label="Wind" value={wind(c.windSpeed, prefs.windUnit)} sub={`${compass(c.windDirection)} · gusts ${wind(c.windGusts, prefs.windUnit)}`} />
            <Metric label="Humidity" value={`${Math.round(c.humidity)}%`} sub={c.dewPoint != null ? `Dew point ${temp(c.dewPoint, prefs.tempUnit)}` : undefined} />
            <Metric label="Rain chance" value={`${today.precipProbMax}%`} sub={`${today.precipSum.toFixed(1)} mm today`} />
            <Metric label="Pressure" value={`${Math.round(c.pressure)} hPa`} />
            <Metric label="UV index" value={c.uvIndex != null ? String(Math.round(c.uvIndex)) : "—"} sub={uvLevel(c.uvIndex)} />
            <Metric label="Visibility" value={c.visibility != null ? `${(c.visibility / 1000).toFixed(c.visibility < 10000 ? 1 : 0)} km` : "—"} />
            <Metric label="Clouds" value={`${Math.round(c.cloudCover)}%`} />
            <Metric label="Air quality" value={air?.usAqi != null ? String(Math.round(air.usAqi)) : "—"} sub={aq.label} color={aq.color} />
          </dl>
        </div>
      </section>

      {/* Hourly */}
      <section className="card p-5" aria-labelledby="hourly-h">
        <h2 id="hourly-h" className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
          Next 48 hours
        </h2>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
          {next48.map((h, i) => (
            <div key={h.time} className={`flex w-14 shrink-0 flex-col items-center rounded-xl py-2 ${i === 0 ? "bg-accent/10" : ""}`}>
              <span className={`h-4 whitespace-nowrap text-[10px] font-medium ${i === 0 || h.time.slice(11, 13) === "00" ? "text-accent" : ""}`}>
                {i === 0 || h.time.slice(11, 13) === "00" ? shortDate(h.time).split(" ").slice(0, 2).join(" ").replace(",", "") : ""}
              </span>
              <span className="text-[11px] text-fg-faint">{i === 0 ? "Now" : hourLabel(h.time, prefs.timeFormat)}</span>
              <WeatherIcon code={h.weatherCode} isDay={h.isDay} size={30} />
              <span className="text-sm font-medium">{temp(h.temperature, prefs.tempUnit)}</span>
              <span className="h-4 text-[11px] text-accent">{h.precipProb >= 10 ? `${h.precipProb}%` : ""}</span>
            </div>
          ))}
        </div>
        <HourlyChart hours={next48} tempUnit={prefs.tempUnit} timeFormat={prefs.timeFormat} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tomorrow */}
        {tomorrow && (
          <section className="card p-5" aria-labelledby="tmr-h">
            <h2 id="tmr-h" className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
              Tomorrow · {shortDate(tomorrow.date)}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <WeatherIcon code={tomorrow.weatherCode} size={56} />
              <div>
                <div className="text-3xl font-light">
                  {temp(tomorrow.tempMax, prefs.tempUnit)}
                  <span className="text-lg text-fg-faint"> / {temp(tomorrow.tempMin, prefs.tempUnit)}</span>
                </div>
                <div className="text-sm text-fg-muted">{tmrLabel}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <Row k="Rain" v={`${tomorrow.precipProbMax}% · ${tomorrow.precipSum.toFixed(1)} mm`} />
              {tmrRain && <Row k="Rain expected" v={tmrRain} />}
              <Row k="Wind" v={`${wind(tomorrow.windMax, prefs.windUnit)} ${compass(tomorrow.windDirection)}`} />
              <Row k="Gusts" v={wind(tomorrow.gustMax, prefs.windUnit)} />
              <Row k="UV max" v={`${Math.round(tomorrow.uvMax)} · ${uvLevel(tomorrow.uvMax)}`} />
              <Row k="Sunrise / sunset" v={`${clock(tomorrow.sunrise, prefs.timeFormat)} / ${clock(tomorrow.sunset, prefs.timeFormat)}`} />
            </ul>
          </section>
        )}

        {/* 7 days */}
        <section className="card p-5 lg:col-span-2" aria-labelledby="week-h">
          <h2 id="week-h" className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
            7-day forecast
          </h2>
          <WeekList days={f.daily.slice(0, 8)} tempUnit={prefs.tempUnit} />
        </section>
      </div>

      {!compact && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Air quality */}
          <section className="card p-5" aria-labelledby="aqi-h">
            <h2 id="aqi-h" className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
              Air quality
            </h2>
            <div className="mt-3 flex items-end gap-3">
              <div className="text-5xl font-light" style={{ color: aq.color }}>
                {air?.usAqi != null ? Math.round(air.usAqi) : "—"}
              </div>
              <div className="pb-1.5 text-sm font-medium" style={{ color: aq.color }}>
                {aq.label}
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg,#3ecf8e,#f5c542 20%,#ff9a3c 33%,#ff5a5a 45%,#b469ff 66%,#8b1d3b)" }}>
              <div
                className="h-full w-1 bg-white shadow"
                style={{ marginLeft: `${Math.min(100, ((air?.usAqi ?? 0) / 300) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-fg-muted">{aq.tip}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Row k="PM2.5" v={air?.pm25 != null ? `${air.pm25.toFixed(0)} µg/m³` : "—"} />
              <Row k="PM10" v={air?.pm10 != null ? `${air.pm10.toFixed(0)} µg/m³` : "—"} />
              <Row k="NO₂" v={air?.no2 != null ? `${air.no2.toFixed(0)} µg/m³` : "—"} />
              <Row k="O₃" v={air?.o3 != null ? `${air.o3.toFixed(0)} µg/m³` : "—"} />
            </ul>
          </section>

          {/* History */}
          <section className="card p-5 lg:col-span-2" aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
              Past 7 days
            </h2>
            {history ? <HistoryChart days={history} tempUnit={prefs.tempUnit} /> : <div className="mt-3 h-56 animate-pulse rounded-xl bg-ink-800" />}
          </section>
        </div>
      )}

      <p className="text-center text-xs text-fg-faint">
        Forecast data: Open-Meteo.com · Elevation {Math.round(f.elevation)} m · Timezone {f.timezone}
      </p>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider text-fg-faint">{label}</dt>
      <dd className="mt-0.5 font-semibold" style={color ? { color } : undefined}>
        {value}
      </dd>
      {sub && <dd className="truncate text-xs text-fg-faint">{sub}</dd>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between gap-3 border-b border-ink-700/60 pb-1.5">
      <span className="text-fg-faint">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </li>
  );
}

export function WeekList({ days, tempUnit }: { days: Forecast["daily"]; tempUnit: "C" | "F" }) {
  const lo = Math.min(...days.map((d) => d.tempMin));
  const hi = Math.max(...days.map((d) => d.tempMax));
  return (
    <ul className="mt-2 divide-y divide-ink-700/60">
      {days.map((d, i) => (
        <li key={d.date} className="grid grid-cols-[72px_36px_1fr_auto] items-center gap-3 py-2.5 sm:grid-cols-[96px_40px_64px_1fr_auto]">
          <div>
            <div className="text-sm font-medium">{i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName(d.date)}</div>
            <div className="text-[11px] text-fg-faint">{dateLabel(d.date)}</div>
          </div>
          <WeatherIcon code={d.weatherCode} size={32} />
          <div className="hidden text-xs text-accent sm:block">{d.precipProbMax >= 10 ? `${d.precipProbMax}% · ${d.precipSum.toFixed(0)}mm` : ""}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-9 text-right text-fg-faint">{temp(d.tempMin, tempUnit)}</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-ink-700">
              <div
                className="absolute h-full rounded-full"
                style={{
                  left: `${((d.tempMin - lo) / Math.max(1, hi - lo)) * 100}%`,
                  right: `${100 - ((d.tempMax - lo) / Math.max(1, hi - lo)) * 100}%`,
                  background: "linear-gradient(90deg,#41c7b9,#e8dd4a,#f59b2f)",
                }}
              />
            </div>
            <span className="w-9 font-medium">{temp(d.tempMax, tempUnit)}</span>
          </div>
          <div className="hidden text-xs text-fg-faint sm:block">{describe(d.weatherCode).label}</div>
        </li>
      ))}
    </ul>
  );
}
