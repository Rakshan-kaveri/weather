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
  episodeId: string | null;
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
    await Promise.all((["Green", "Orange", "Red"] as const).map(async (level) => {
      try {
        const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=${level}&fromDate=${fmt(from)}&toDate=${fmt(to)}&pageSize=100`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j: any = await res.json().catch(() => null);
        for (const f of j?.features ?? []) {
          const p = f.properties ?? {};
          const current = p.iscurrent === true || String(p.iscurrent).toLowerCase() === "true";
          const ended = p.todate && Date.parse(p.todate) < Date.now() - 2 * 86400_000;
          if (!current && ended) continue;
          const [lon, lat] = f.geometry?.coordinates ?? [];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const episodeFromUrl = /episodeid=(\d+)/i.exec(JSON.stringify(p.url ?? ""))?.[1];
          all.push({
            id: String(p.eventid),
            episodeId: p.episodeid != null ? String(p.episodeid) : episodeFromUrl ?? null,
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
        /* feed unavailable for this level */
      }
    }));
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

/* Distances that trigger cyclone warnings, measured to the nearest point of the cyclone's current position
   OR its forecast track (so a storm heading your way warns you early, and a far-away one doesn't). */
const CYCLONE_SEVERE_KM = 150;
const CYCLONE_WARNING_KM = 300;
const CYCLONE_WATCH_KM = 500; // shown as a banner on the forecast page only, never emailed/SMSed

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, g: { type: string; coordinates: unknown }) {
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as number[][][][];
  return polys.some((p) => p.length && pointInRing(lon, lat, p[0]));
}

export async function cycloneWarnings(lat: number, lon: number, cyclones: Cyclone[], today: string): Promise<Warning[]> {
  const out: Warning[] = [];
  for (const c of cyclones) {
    const now = distanceKm(lat, lon, c.lat, c.lon);
    if (now > 2500) continue; // nowhere near — skip the track lookup entirely

    let closest = now;
    let closestTime: string | undefined;
    let inCone = false;
    try {
      const track = await cycloneTrack(c.id, c.episodeId);
      for (const f of track) {
        if (f.kind === "point" && f.geometry.type === "Point") {
          const [plon, plat] = f.geometry.coordinates as number[];
          const d = distanceKm(lat, lon, plat, plon);
          if (d < closest) {
            closest = d;
            closestTime = f.time;
          }
        } else if (f.kind === "area" && f.level === "cone" && inPolygon(lon, lat, f.geometry)) {
          inCone = true;
        }
      }
    } catch {
      /* no track — use current position only */
    }

    const km = Math.round(closest);
    let level: Level | null = null;
    if (closest <= CYCLONE_SEVERE_KM || (inCone && closest <= CYCLONE_WARNING_KM)) level = "severe";
    else if (closest <= CYCLONE_WARNING_KM || inCone) level = "warning";
    else if (closest <= CYCLONE_WATCH_KM) level = "watch";
    if (!level) continue;

    const approaching = closest < now - 25;
    const when = closestTime ? ` around ${closestTime.replace("T", " ").slice(5, 16)}` : "";
    out.push({
      type: "cyclone",
      level,
      title: approaching ? `Cyclone ${c.name} forecast to pass ${km} km away` : `Cyclone ${c.name} ${km} km away`,
      message:
        (approaching
          ? `Tropical cyclone ${c.name} is now ${Math.round(now)} km away and forecast to pass about ${km} km from this place${when}.`
          : `Tropical cyclone ${c.name} is ${km} km from this place.`) +
        (inCone ? " This place is inside the forecast cone." : "") +
        ` GDACS ${c.alertLevel} alert${c.severity ? ` (${c.severity})` : ""}.` +
        (level === "watch" ? " Keep an eye on updates." : " Follow IMD and district administration advisories, keep phones charged, store drinking water and stay away from the coast."),
      date: today,
      source: "gdacs",
      link: c.link,
    });
  }
  return out;
}

/** All warnings for one place (forecast rules + nearby cyclones). */
export async function warningsFor(lat: number, lon: number): Promise<Warning[]> {
  const [fc, cyclones] = await Promise.all([getForecast(lat, lon), activeCyclones().catch(() => [])]);
  const today = fc.current.time.slice(0, 10);
  const list = [...(await cycloneWarnings(lat, lon, cyclones, today)), ...assessForecast(fc)];
  return list.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
}

/* ─── Cyclone track & forecast (GDACS event geometry) ─── */

export type TrackFeature = {
  kind: "past" | "forecast" | "point" | "area";
  level?: "Green" | "Orange" | "Red" | "cone";
  label?: string;
  windKmh?: number;
  time?: string;
  // GeoJSON geometry, coordinates rounded
  geometry: { type: string; coordinates: unknown };
};

const round = (v: unknown): unknown => (Array.isArray(v) ? v.map(round) : typeof v === "number" ? Math.round(v * 1000) / 1000 : v);

/**
 * Track line, track points and wind-impact areas for one cyclone, from GDACS's public geometry API.
 * GDACS labels each feature with a "Class" such as Point_*, Line_*, Poly_Red/Orange/Green or Poly_Cones;
 * anything unrecognised is still drawn generically, so the map degrades gracefully if the format shifts.
 */
export async function cycloneTrack(eventId: string, episodeId: string | null): Promise<TrackFeature[]> {
  if (!/^\d+$/.test(eventId) || (episodeId && !/^\d+$/.test(episodeId))) return [];
  return cached(`gdacs:track:${eventId}:${episodeId ?? ""}`, 1800, async () => {
    const url = `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${eventId}${episodeId ? `&episodeid=${episodeId}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => null);
    const out: TrackFeature[] = [];
    for (const f of j?.features ?? []) {
      const g = f.geometry;
      if (!g?.type || !g.coordinates) continue;
      const p = f.properties ?? {};
      const cls = String(p.Class ?? p.class ?? p.polygonlabel ?? "");
      const text = JSON.stringify(p).toLowerCase();
      const isForecast = /forecast/.test(text) || /forecast/i.test(cls);
      const geometry = { type: g.type, coordinates: round(g.coordinates) };
      if (g.type === "Point" || g.type === "MultiPoint") {
        const when = p.trackdate || p.datetime || p.advisory_datetime || p.polygondate || "";
        const wind = p.windspeed ?? p.wind_speed ?? p.maxwind;
        out.push({
          kind: "point",
          level: /red/i.test(cls) ? "Red" : /orange/i.test(cls) ? "Orange" : isForecast ? "cone" : undefined,
          label: [when ? String(when).replace("T", " ").slice(0, 16) : "", wind ? `${Math.round(Number(wind))} km/h` : ""].filter(Boolean).join(" · ") || undefined,
          windKmh: wind != null && Number.isFinite(Number(wind)) ? Math.round(Number(wind)) : undefined,
          time: when ? String(when) : undefined,
          geometry,
        });
      } else if (g.type.includes("LineString")) {
        out.push({ kind: isForecast ? "forecast" : "past", geometry });
      } else if (g.type.includes("Polygon")) {
        const level = /cone/i.test(cls) ? "cone" : /red/i.test(cls) ? "Red" : /orange/i.test(cls) ? "Orange" : /green/i.test(cls) ? "Green" : "cone";
        out.push({ kind: "area", level, geometry });
      }
    }
    return out;
  });
}
