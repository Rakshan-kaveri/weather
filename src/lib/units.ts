export type Prefs = {
  tempUnit: "C" | "F";
  windUnit: "kmh" | "ms" | "mph" | "kn";
  timeFormat: "12" | "24";
  theme: "dark" | "light";
};

export const DEFAULT_PREFS: Prefs = { tempUnit: "C", windUnit: "kmh", timeFormat: "24", theme: "dark" };

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

export function hourLabel(iso: string, fmt: Prefs["timeFormat"] = "24") {
  const h = Number(iso.slice(11, 13));
  if (fmt === "24") return `${String(h).padStart(2, "0")}:00`;
  const suffix = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${suffix}`;
}

export function clock(iso: string, fmt: Prefs["timeFormat"] = "24") {
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
