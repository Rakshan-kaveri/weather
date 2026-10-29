import { cached } from "./cache";
import { getForecast, type Forecast } from "./weather";

/**
 * Severe-weather detection.
 *  - Thunderstorms, intense downpours and gales come from the hourly forecast (next 48 h).
 *  - Heavy rain uses the India Meteorological Department (IMD) 24-hour rainfall categories.
 *  - Cyclones come from the GDACS live tropical-cyclone feed (UN / European Commission).
 */

export type Hazard = "thunderstorm" | "heavy_rain" | "downpour" | "strong_wind" | "cyclone";
export type Level = "watch" | "warning" | "severe";

export type Warning = {
  type: Hazard;
  level: Level;
  title: string;
  message: string;
  date: string; // local date the hazard starts (YYYY-MM-DD)
  startsAt?: string; // local ISO hour
  source: "forecast" | "gdacs";
  link?: string;
};

export const LEVEL_RANK: Record<Level, number> = { watch: 1, warning: 2, severe: 3 };

const hourLabel = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  const day = new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day}, ${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
};

/** Rules applied to the next 48 hours of the forecast. */
export function assessForecast(fc: Forecast): Warning[] {
  const out: Warning[] = [];
  const nowHour = fc.current.time.slice(0, 13);
  const start = Math.max(0, fc.hourly.findIndex((h) => h.time.slice(0, 13) === nowHour));
  const next = fc.hourly.slice(start, start + 48);

  // Thunderstorms (WMO codes 95, 96, 99)
  const storms = next.filter((h) => h.weatherCode >= 95 && h.precipProb >= 40);
  if (storms.length) {
    const hail = storms.some((h) => h.weatherCode >= 96);
    const first = storms[0];
    out.push({
      type: "thunderstorm",
      level: hail || storms.length >= 4 ? "severe" : "warning",
      title: hail ? "Severe thunderstorm with hail" : "Thunderstorm expected",
      message: `Thunderstorms likely from ${hourLabel(first.time)} (${first.precipProb}% chance)${hail ? ", possibly with hail" : ""}. Stay indoors during lightning, unplug appliances and avoid open fields and trees.`,
      date: first.time.slice(0, 10),
      startsAt: first.time,
      source: "forecast",
    });
  }

  // Heavy rain — IMD 24-hour categories
  for (const d of fc.daily.slice(0, 3)) {
    let level: Level | null = null;
    let label = "";
    if (d.precipSum >= 204.5) [level, label] = ["severe", "Extremely heavy rain"];
    else if (d.precipSum >= 115.6) [level, label] = ["severe", "Very heavy rain"];
    else if (d.precipSum >= 64.5) [level, label] = ["warning", "Heavy rain"];
    else if (d.precipSum >= 35.5 && d.precipProbMax >= 70) [level, label] = ["watch", "Rather heavy rain"];
    if (!level) continue;
    out.push({
      type: "heavy_rain",
      level,
      title: `${label} forecast`,
      message: `About ${Math.round(d.precipSum)} mm of rain expected on ${hourLabel(d.date + "T00:00").split(",")[0]}. Watch for waterlogging and flooding in low-lying areas; avoid crossing flowing water.`,
      date: d.date,
      source: "forecast",
    });
    break;
  }

  // Intense short bursts (cloudbursts / flash-flood risk)
  const burst = next.find((h) => h.precipitation >= 20);
  if (burst) {
    out.push({
      type: "downpour",
      level: burst.precipitation >= 50 ? "severe" : "warning",
      title: "Intense downpour",
      message: `Up to ${Math.round(burst.precipitation)} mm in one hour around ${hourLabel(burst.time)}. Flash flooding is possible.`,
      date: burst.time.slice(0, 10),
      startsAt: burst.time,
      source: "forecast",
    });
  }

  // Gales (IMD: 62+ km/h gale, 89+ km/h storm force)
  const gust = next.reduce((m, h) => (h.windGusts > m.windGusts ? h : m), next[0] ?? { windGusts: 0, time: "" });
  if (gust && gust.windGusts >= 62) {
    out.push({
      type: "strong_wind",
      level: gust.windGusts >= 89 ? "severe" : "warning",
      title: gust.windGusts >= 89 ? "Storm-force winds" : "Strong winds",
      message: `Gusts up to ${Math.round(gust.windGusts)} km/h around ${hourLabel(gust.time)}. Secure loose objects; fishermen should not go out to sea.`,
      date: gust.time.slice(0, 10),
      startsAt: gust.time,
      source: "forecast",
    });
  }
  return out;
}

/* ─── Cyclones (GDACS) ──────────────────────────────────── */

export type Cyclone = {
  id: string;
  name: string;
  alertLevel: "Green" | "Orange" | "Red";
  lat: number;
  lon: number;
  from: string;
  to: string;
  severity: string;
  link: string;
};

export async function activeCyclones(): Promise<Cyclone[]> {
  return cached("gdacs:tc", 1800, async () => {
    const to = new Date();
    const from = new Date(Date.now() - 14 * 86400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const all: Cyclone[] = [];
    for (const level of ["Green", "Orange", "Red"] as const) {
      try {
        const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=${level}&fromDate=${fmt(from)}&toDate=${fmt(to)}&pageSize=100`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j: any = await res.json().catch(() => null);
        for (const f of j?.features ?? []) {
          const p = f.properties ?? {};
          const current = p.iscurrent === true || String(p.iscurrent).toLowerCase() === "true";
          const ended = p.todate && Date.parse(p.todate) < Date.now() - 2 * 86400_000;
          if (!current && ended) continue;
          const [lon, lat] = f.geometry?.coordinates ?? [];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          all.push({
            id: String(p.eventid),
            name: p.eventname || p.name || "Tropical cyclone",
            alertLevel: (p.alertlevel || level) as Cyclone["alertLevel"],
            lat,
            lon,
            from: p.fromdate,
            to: p.todate,
            severity: p.severitydata?.severitytext ?? "",
            link: p.url?.report || `https://www.gdacs.org/report.aspx?eventtype=TC&eventid=${p.eventid}`,
          });
        }
      } catch {
        /* feed unavailable — try next level */
      }
    }
    // de-duplicate by event id, keep the highest alert level
    const rank = { Green: 1, Orange: 2, Red: 3 };
    const byId = new Map<string, Cyclone>();
    for (const c of all) if (!byId.has(c.id) || rank[c.alertLevel] > rank[byId.get(c.id)!.alertLevel]) byId.set(c.id, c);
    return [...byId.values()];
  });
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const CYCLONE_RADIUS_KM = { Green: 400, Orange: 700, Red: 1000 };

export function cycloneWarnings(lat: number, lon: number, cyclones: Cyclone[], today: string): Warning[] {
  return cyclones
    .map((c) => ({ c, d: distanceKm(lat, lon, c.lat, c.lon) }))
    .filter(({ c, d }) => d <= CYCLONE_RADIUS_KM[c.alertLevel])
    .map(({ c, d }) => ({
      type: "cyclone" as const,
      level: (c.alertLevel === "Red" || d < 300 ? "severe" : c.alertLevel === "Orange" ? "warning" : "watch") as Level,
      title: `Cyclone ${c.name} ${Math.round(d)} km away`,
      message: `Tropical cyclone ${c.name} (${c.alertLevel} alert${c.severity ? `, ${c.severity}` : ""}) is ${Math.round(d)} km from this place. Follow IMD and district administration advisories, keep phones charged, store drinking water and stay away from the coast.`,
      date: today,
      source: "gdacs" as const,
      link: c.link,
    }));
}

/** All warnings for one place (forecast rules + nearby cyclones). */
export async function warningsFor(lat: number, lon: number): Promise<Warning[]> {
  const [fc, cyclones] = await Promise.all([getForecast(lat, lon), activeCyclones().catch(() => [])]);
  const today = fc.current.time.slice(0, 10);
  const list = [...cycloneWarnings(lat, lon, cyclones, today), ...assessForecast(fc)];
  return list.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
}
