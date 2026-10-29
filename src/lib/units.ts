export type Prefs = {
  tempUnit: "C" | "F";
  windUnit: "kmh" | "ms" | "mph" | "kn";
  timeFormat: "12" | "24";
  theme: "dark" | "light";
};

export const DEFAULT_PREFS: Prefs = { tempUnit: "C", windUnit: "kmh", timeFormat: "12", theme: "dark" };

export function temp(c: number | null | undefined, unit: Prefs["tempUnit"] = "C", withUnit = false) {
  if (c == null || Number.isNaN(c)) return "—";
  const v = unit === "F" ? c * 1.8 + 32 : c;
  return `${Math.round(v)}°${withUnit ? unit : ""}`;
}

export function wind(kmh: number | null | undefined, unit: Prefs["windUnit"] = "kmh") {
  if (kmh == null) return "—";
  switch (unit) {
    case "ms":
      return `${(kmh / 3.6).toFixed(1)} m/s`;
    case "mph":
      return `${Math.round(kmh / 1.609)} mph`;
    case "kn":
      return `${Math.round(kmh / 1.852)} kn`;
    default:
      return `${Math.round(kmh)} km/h`;
  }
}

/** 0–23 → "12 AM", "1 PM" … */
export function h12(hour: number) {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

/** "2026-10-30" → "Fri, 30 Oct" */
export function shortDate(isoDate: string) {
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00Z");
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

/** When rain is expected during a day: "1 PM – 4 PM", "6 AM – 9 AM, 2 PM – 5 PM", "most of the day" or null. */
export function rainWindow(hours: { time: string; precipitation: number; precipProb: number }[]) {
  const wet = hours.filter((h) => h.precipitation >= 0.1 && h.precipProb >= 30).map((h) => Number(h.time.slice(11, 13)));
  if (!wet.length) return null;
  if (wet.length >= 14) return "Most of the day";
  const spells: [number, number][] = [];
  for (const hr of wet) {
    const last = spells[spells.length - 1];
    if (last && hr - last[1] <= 2) last[1] = hr;
    else spells.push([hr, hr]);
  }
  const end = (hr: number) => (hr + 1 >= 24 ? "midnight" : h12(hr + 1));
  const longest = [...spells].sort((x, y) => y[1] - y[0] - (x[1] - x[0])).slice(0, 2).sort((x, y) => x[0] - y[0]);
  return longest.map(([from, to]) => `${h12(from)} – ${end(to)}`).join(", ");
}

export function hourLabel(iso: string, fmt: Prefs["timeFormat"] = "12") {
  const h = Number(iso.slice(11, 13));
  if (fmt === "24") return `${String(h).padStart(2, "0")}:00`;
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}

export function clock(iso: string, fmt: Prefs["timeFormat"] = "12") {
  const h = Number(iso.slice(11, 13));
  const m = iso.slice(14, 16);
  if (fmt === "24") return `${String(h).padStart(2, "0")}:${m}`;
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${suffix}`;
}

export function dayName(isoDate: string, short = true) {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("en-IN", { weekday: short ? "short" : "long", timeZone: "UTC" });
}

export function dateLabel(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
