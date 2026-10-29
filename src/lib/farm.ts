import type { DayPoint, Forecast, HourPoint } from "./weather";
import { hoursFor } from "./weather";
import { h12 } from "./units";

/**
 * Farm advisory computed from the forecast (no language here; see i18n.ts for wording).
 * Thresholds are common agronomy rules of thumb:
 *  - spraying: daylight, wind < 12 km/h, rain chance < 20% now and for the next 3 hours
 *  - irrigation: FAO-56 reference evapotranspiration (ET0) vs. expected rain, adjusted by soil moisture
 *  - fungal disease: hours with humidity ≥ 85% at 18–30 °C (leaf-wetness proxy)
 *  - livestock: Temperature-Humidity Index (THI) — ≥ 72 stress, ≥ 79 severe
 */

export type FarmItem =
  | { key: "spray"; ok: true; windows: string[] }
  | { key: "spray"; ok: false }
  | { key: "irrigation"; need: "high" | "light" | "none"; deficit: number; et0: number; rain: number }
  | { key: "soil"; moisturePct: number; level: "dry" | "moderate" | "wet"; tempC: number | null }
  | { key: "disease"; risk: "high" | "moderate" | "low"; hours: number }
  | { key: "livestock"; thi: number; level: "severe" | "mild" | "ok" }
  | { key: "harvest"; good: boolean }
  | { key: "fertilizer"; advice: "avoid" | "good" | "irrigate" }
  | { key: "sowing" }
  | { key: "heavyRain"; mm: number }
  | { key: "wind"; gust: number }
  | { key: "outlook"; days: { date: string; rain: number; prob: number }[] };

const hourOf = (h: HourPoint) => Number(h.time.slice(11, 13));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function sprayWindows(hours: HourPoint[]) {
  const ok = hours.map((h, i) => {
    const hr = hourOf(h);
    const next = hours.slice(i, i + 3);
    return hr >= 6 && hr <= 17 && h.windSpeed < 12 && next.every((n) => n.precipProb < 30) && h.precipProb < 20;
  });
  const windows: string[] = [];
  let start = -1;
  for (let i = 0; i <= ok.length; i++) {
    if (ok[i] && start < 0) start = i;
    if (!ok[i] && start >= 0) {
      if (i - start >= 2) windows.push(`${h12(hourOf(hours[start]))}–${h12((hourOf(hours[i - 1]) + 1) % 24)}`);
      start = -1;
    }
  }
  return windows.slice(0, 2);
}

export function farmAdvice(fc: Forecast, day: DayPoint): FarmItem[] {
  const hours = hoursFor(fc, day.date);
  const items: FarmItem[] = [];
  const dayIdx = fc.daily.findIndex((d) => d.date === day.date);
  const next2 = fc.daily.slice(dayIdx, dayIdx + 2);
  const rain48 = next2.reduce((a, d) => a + d.precipSum, 0);

  if (day.precipSum >= 20) items.push({ key: "heavyRain", mm: Math.round(day.precipSum) });

  const windows = sprayWindows(hours);
  items.push(windows.length ? { key: "spray", ok: true, windows } : { key: "spray", ok: false });

  // Soil moisture (daily mean of 3–9 cm layer)
  const sm = hours.map((h) => h.soilMoisture).filter((v): v is number => v != null);
  const st = hours.map((h) => h.soilTemp).filter((v): v is number => v != null);
  const moisture = sm.length ? avg(sm) : null;

  // Irrigation: crop water use (ET0) minus effective rain (≈ 80% of rain), adjusted for soil moisture
  const et0 = day.et0 ?? hours.reduce((a, h) => a + (h.et0 ?? 0), 0);
  const effRain = day.precipSum * 0.8;
  let deficit = Math.max(0, et0 - effRain);
  if (moisture != null && moisture > 0.32) deficit = 0;
  const need: "high" | "light" | "none" = deficit >= 4 && (moisture == null || moisture < 0.25) ? "high" : deficit >= 2 ? "light" : "none";
  items.push({ key: "irrigation", need, deficit: Math.round(deficit * 10) / 10, et0: Math.round(et0 * 10) / 10, rain: Math.round(day.precipSum * 10) / 10 });

  if (moisture != null) {
    items.push({
      key: "soil",
      moisturePct: Math.round(moisture * 100),
      level: moisture < 0.15 ? "dry" : moisture > 0.32 ? "wet" : "moderate",
      tempC: st.length ? Math.round(avg(st)) : null,
    });
  }

  // Fungal disease risk (long humid spells at mild temperatures)
  const wetHours = hours.filter((h) => h.humidity >= 85 && h.temperature >= 18 && h.temperature <= 30).length;
  items.push({ key: "disease", risk: wetHours >= 10 ? "high" : wetHours >= 5 ? "moderate" : "low", hours: wetHours });

  // Livestock heat stress at the hottest hour
  const hot = hours.reduce((m, h) => (h.temperature > m.temperature ? h : m), hours[0] ?? { temperature: day.tempMax, humidity: 60 } as HourPoint);
  const T = hot.temperature;
  const RH = hot.humidity;
  const thi = Math.round(1.8 * T + 32 - (0.55 - 0.0055 * RH) * (1.8 * T - 26));
  items.push({ key: "livestock", thi, level: thi >= 79 ? "severe" : thi >= 72 ? "mild" : "ok" });

  // Harvest & drying
  const dayHours = hours.filter((h) => hourOf(h) >= 8 && hourOf(h) <= 17);
  const meanRh = avg(dayHours.map((h) => h.humidity));
  items.push({ key: "harvest", good: day.precipProbMax < 25 && day.precipSum < 1 && meanRh < 75 });

  // Fertiliser timing
  items.push({ key: "fertilizer", advice: rain48 >= 20 ? "avoid" : day.precipSum >= 2 && day.precipSum <= 15 ? "good" : "irrigate" });

  // Sowing conditions
  const rain3 = fc.daily.slice(dayIdx, dayIdx + 3).reduce((a, d) => a + d.precipSum, 0);
  if ((moisture != null && moisture >= 0.25 && moisture <= 0.4) || (rain3 >= 10 && rain3 <= 40)) items.push({ key: "sowing" });

  if (day.gustMax >= 40) items.push({ key: "wind", gust: Math.round(day.gustMax) });

  items.push({
    key: "outlook",
    days: fc.daily.slice(dayIdx + 1, dayIdx + 4).map((d) => ({ date: d.date, rain: Math.round(d.precipSum), prob: d.precipProbMax })),
  });
  return items;
}
