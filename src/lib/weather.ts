import { cached } from "./cache";

/**
 * Weather data comes from Open-Meteo (https://open-meteo.com) — free, no API key.
 * Every call is cached in memory so repeated page loads don't hit the API.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

export type Current = {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  isDay: boolean;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  uvIndex: number | null;
  visibility: number | null;
  dewPoint: number | null;
};

export type HourPoint = {
  time: string;
  temperature: number;
  feelsLike: number;
  precipProb: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  humidity: number;
  uvIndex: number;
  cloudCover: number;
  isDay: boolean;
  soilMoisture: number | null; // m³/m³ at 3–9 cm
  soilTemp: number | null; // °C at 6 cm
  et0: number | null; // reference evapotranspiration, mm/h
};

export type DayPoint = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  precipProbMax: number;
  windMax: number;
  gustMax: number;
  windDirection: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
  et0: number | null; // mm/day (FAO-56 reference evapotranspiration)
  sunshineHours: number | null;
};

export type Forecast = {
  lat: number;
  lon: number;
  timezone: string;
  utcOffsetSeconds: number;
  elevation: number;
  current: Current;
  hourly: HourPoint[];
  daily: DayPoint[];
};

export type AirQuality = {
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  hourly: { time: string; usAqi: number | null; pm25: number | null }[];
};

export type GeoResult = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  countryCode?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
  population?: number;
};

/**
 * Open-Meteo's free tier allows ~600 calls/min, 5,000/hour and 10,000/day (a multi-point request counts once
 * per point). When it answers 429 we back off for a while and only let the important requests (a single
 * place's forecast) through, so the map's background heat-map never starves a user's click.
 */
let coolDownUntil = 0;
export function upstreamBusy() {
  return Date.now() < coolDownUntil;
}

async function getJson<T>(url: string, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 1;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) return (await res.json()) as T;
      const body = await res.text().catch(() => "");
      if (res.status === 429) coolDownUntil = Date.now() + (/hour|daily/i.test(body) ? 10 * 60_000 : 60_000);
      const err = new Error(`Weather API ${res.status}: ${body.slice(0, 200)}`);
      if (res.status < 500 && res.status !== 429) throw Object.assign(err, { final: true });
      throw err;
    } catch (e) {
      if ((e as { final?: boolean }).final || attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function clampCoords(lat: number, lonRaw: number) {
  // the map repeats the world sideways, so a click can arrive as e.g. 434.7° — bring it back to −180…180
  const lon = Number.isFinite(lonRaw) ? ((((lonRaw + 180) % 360) + 360) % 360) - 180 : lonRaw;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error("Invalid coordinates");
  }
  return { lat: round(lat), lon: round(lon) };
}

/**
 * The API's daily weather_code is the *most severe* hour of the day, so a single 0.2 mm shower at 3 AM
 * turns a sunny day into "rain". Work out what the day actually looks like from its hourly data instead:
 *  - not a rain day (< 1 mm total and at most one hour with measurable rain) → sky from daytime cloud cover
 *  - light rain day (< 2.5 mm) → "slight showers" rather than "moderate/heavy rain"
 *  - otherwise keep the API's code (real rain / thunderstorm days)
 */
export function representativeCode(day: DayPoint, hourly: HourPoint[]): number {
  const hours = hourly.filter((h) => h.time.startsWith(day.date));
  if (!hours.length) return day.weatherCode;
  const wetHours = hours.filter((h) => h.precipitation >= 0.3).length;
  const sum = hours.reduce((a, h) => a + h.precipitation, 0);
  if (sum < 1 && wetHours <= 1) {
    const daytime = hours.filter((h) => {
      const hr = Number(h.time.slice(11, 13));
      return hr >= 8 && hr <= 17;
    });
    const cloud = daytime.reduce((a, h) => a + h.cloudCover, 0) / Math.max(1, daytime.length);
    const fog = daytime.filter((h) => h.weatherCode === 45 || h.weatherCode === 48).length >= 4;
    if (fog) return 45;
    return cloud < 20 ? 0 : cloud < 50 ? 1 : cloud < 80 ? 2 : 3;
  }
  if (sum < 2.5 && day.weatherCode >= 51 && day.weatherCode < 95) return 80;
  if (day.weatherCode >= 95 && wetHours < 2) return 80; // isolated cell, not a stormy day
  return day.weatherCode;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getForecast(latIn: number, lonIn: number): Promise<Forecast> {
  const { lat, lon } = clampCoords(latIn, lonIn);
  return cached(`fc:${lat}:${lon}`, 600, async () => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      forecast_days: "8",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "pressure_msl",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
      ].join(","),
      hourly: [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "relative_humidity_2m",
        "uv_index",
        "visibility",
        "cloud_cover",
        "dew_point_2m",
        "is_day",
        "soil_moisture_3_to_9cm",
        "soil_temperature_6cm",
        "et0_fao_evapotranspiration",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "wind_direction_10m_dominant",
        "sunrise",
        "sunset",
        "uv_index_max",
        "et0_fao_evapotranspiration",
        "sunshine_duration",
      ].join(","),
    });
    const j: any = await getJson(`${FORECAST}?${params}`);
    const h = j.hourly;
    const hourly: HourPoint[] = h.time.map((t: string, i: number) => ({
      time: t,
      temperature: h.temperature_2m[i],
      feelsLike: h.apparent_temperature[i],
      precipProb: h.precipitation_probability[i] ?? 0,
      precipitation: h.precipitation[i] ?? 0,
      weatherCode: h.weather_code[i],
      windSpeed: h.wind_speed_10m[i],
      windDirection: h.wind_direction_10m[i],
      windGusts: h.wind_gusts_10m?.[i] ?? 0,
      humidity: h.relative_humidity_2m[i],
      uvIndex: h.uv_index[i] ?? 0,
      cloudCover: h.cloud_cover[i] ?? 0,
      isDay: h.is_day[i] === 1,
      soilMoisture: h.soil_moisture_3_to_9cm?.[i] ?? null,
      soilTemp: h.soil_temperature_6cm?.[i] ?? null,
      et0: h.et0_fao_evapotranspiration?.[i] ?? null,
    }));
    // Pick the hourly values for "now" (visibility / UV / dew point are hourly-only)
    const nowHour = (j.current.time as string).slice(0, 13);
    const idx = Math.max(0, h.time.findIndex((t: string) => t.startsWith(nowHour)));
    const d = j.daily;
    const daily: DayPoint[] = d.time.map((t: string, i: number) => ({
      date: t,
      weatherCode: d.weather_code[i],
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      precipSum: d.precipitation_sum[i] ?? 0,
      precipProbMax: d.precipitation_probability_max[i] ?? 0,
      windMax: d.wind_speed_10m_max[i],
      gustMax: d.wind_gusts_10m_max[i],
      windDirection: d.wind_direction_10m_dominant[i],
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
      uvMax: d.uv_index_max[i] ?? 0,
      et0: d.et0_fao_evapotranspiration?.[i] ?? null,
      sunshineHours: d.sunshine_duration?.[i] != null ? d.sunshine_duration[i] / 3600 : null,
    }));
    for (const day of daily) day.weatherCode = representativeCode(day, hourly);
    const c = j.current;
    return {
      lat: j.latitude,
      lon: j.longitude,
      timezone: j.timezone,
      utcOffsetSeconds: j.utc_offset_seconds,
      elevation: j.elevation,
      current: {
        time: c.time,
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        isDay: c.is_day === 1,
        precipitation: c.precipitation,
        weatherCode: c.weather_code,
        cloudCover: c.cloud_cover,
        pressure: c.pressure_msl,
        windSpeed: c.wind_speed_10m,
        windDirection: c.wind_direction_10m,
        windGusts: c.wind_gusts_10m,
        uvIndex: h.uv_index[idx] ?? null,
        visibility: h.visibility[idx] ?? null,
        dewPoint: h.dew_point_2m[idx] ?? null,
      },
      hourly,
      daily,
    };
  });
}

export async function getAirQuality(latIn: number, lonIn: number): Promise<AirQuality> {
  const { lat, lon } = clampCoords(latIn, lonIn);
  return cached(`aq:${lat}:${lon}`, 1800, async () => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      forecast_days: "2",
      current: "us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,carbon_monoxide",
      hourly: "us_aqi,pm2_5",
    });
    const j: any = await getJson(`${AIR}?${params}`);
    const c = j.current ?? {};
    return {
      usAqi: c.us_aqi ?? null,
      pm25: c.pm2_5 ?? null,
      pm10: c.pm10 ?? null,
      no2: c.nitrogen_dioxide ?? null,
      o3: c.ozone ?? null,
      co: c.carbon_monoxide ?? null,
      hourly: (j.hourly?.time ?? []).map((t: string, i: number) => ({
        time: t,
        usAqi: j.hourly.us_aqi[i] ?? null,
        pm25: j.hourly.pm2_5[i] ?? null,
      })),
    };
  });
}

export type HistoryDay = { date: string; tempMax: number; tempMin: number; precipSum: number; windMax: number };

export async function getHistory(latIn: number, lonIn: number): Promise<HistoryDay[]> {
  const { lat, lon } = clampCoords(latIn, lonIn);
  return cached(`hist:${lat}:${lon}`, 3600, async () => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      past_days: "7",
      forecast_days: "1",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    });
    const j: any = await getJson(`${FORECAST}?${params}`);
    const d = j.daily;
    return d.time.map((t: string, i: number) => ({
      date: t,
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      precipSum: d.precipitation_sum[i] ?? 0,
      windMax: d.wind_speed_10m_max[i],
    }));
  });
}

export async function searchPlaces(q: string): Promise<GeoResult[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  return cached(`geo:${query.toLowerCase()}`, 86400, async () => {
    const params = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" });
    const j: any = await getJson(`${GEO}?${params}`);
    return (j.results ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      country: r.country,
      countryCode: r.country_code,
      admin1: r.admin1,
      admin2: r.admin2,
      timezone: r.timezone,
      population: r.population,
    }));
  });
}

/* ─── Map grid ──────────────────────────────────────────────
 * The map overlays (temperature, wind, rain, clouds, pressure, humidity) are drawn
 * in the browser from a coarse grid of forecast points covering the visible area.
 */

export type GridData = {
  bbox: [number, number, number, number]; // west, south, east, north
  cols: number;
  rows: number;
  times: string[]; // ISO hours (UTC)
  // values[varName][timeIndex][row * cols + col]
  values: Record<GridVar, number[][]>;
};

export type GridVar = "temp" | "windSpeed" | "windDir" | "precip" | "clouds" | "pressure" | "humidity";

const GRID_VARS: Record<GridVar, string> = {
  temp: "temperature_2m",
  windSpeed: "wind_speed_10m",
  windDir: "wind_direction_10m",
  precip: "precipitation",
  clouds: "cloud_cover",
  pressure: "pressure_msl",
  humidity: "relative_humidity_2m",
};

export async function getGrid(west: number, south: number, east: number, north: number): Promise<GridData> {
  // Snap to a step that keeps the grid at ~10 x 8 points whatever the zoom level.
  const span = Math.max(east - west, north - south);
  const steps = [0.25, 0.5, 1, 2, 3, 4, 5, 8, 12];
  const step = steps.find((s) => span / s <= 6) ?? 15;
  const w = Math.max(-180, Math.floor(west / step) * step - step);
  const e = Math.min(180, Math.ceil(east / step) * step + step);
  const s = Math.max(-85, Math.floor(south / step) * step - step);
  const n = Math.min(85, Math.ceil(north / step) * step + step);
  const cols = Math.min(10, Math.round((e - w) / step) + 1);
  const rows = Math.min(9, Math.round((n - s) / step) + 1);
  const dx = (e - w) / (cols - 1);
  const dy = (n - s) / (rows - 1);

  return cached(`grid:${w}:${s}:${e}:${n}:${cols}:${rows}`, 3600, async () => {
    if (upstreamBusy()) throw new Error("Weather API busy");
    const lats: number[] = [];
    const lons: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        lats.push(round(n - r * dy, 3)); // row 0 = north
        lons.push(round(w + c * dx, 3));
      }
    }
    // Open-Meteo accepts many coordinates per request; split into chunks to keep URLs short.
    const chunkSize = 60;
    const chunks: Promise<any[]>[] = [];
    for (let i = 0; i < lats.length; i += chunkSize) {
      const params = new URLSearchParams({
        latitude: lats.slice(i, i + chunkSize).join(","),
        longitude: lons.slice(i, i + chunkSize).join(","),
        hourly: Object.values(GRID_VARS).join(","),
        past_hours: "6",
        forecast_hours: "48",
        timezone: "GMT",
      });
      chunks.push(getJson<any>(`${FORECAST}?${params}`, { retries: 0 }).then((j) => (Array.isArray(j) ? j : [j])));
    }
    const results: any[] = (await Promise.all(chunks)).flat();
    const times: string[] = results[0].hourly.time.map((t: string) => t + ":00Z");
    const values = {} as Record<GridVar, number[][]>;
    (Object.keys(GRID_VARS) as GridVar[]).forEach((k) => {
      const apiKey = GRID_VARS[k];
      values[k] = times.map((_, ti) => results.map((r) => r.hourly[apiKey][ti] ?? 0));
    });
    return { bbox: [w, s, e, n], cols, rows, times, values };
  });
}

/* ─── Values for a specific day (used by reports and alerts) ─── */

export function dayFor(forecast: Forecast, which: "today" | "tomorrow"): DayPoint | undefined {
  return forecast.daily[which === "today" ? 0 : 1];
}

export function hoursFor(forecast: Forecast, date: string) {
  return forecast.hourly.filter((h) => h.time.startsWith(date));
}
