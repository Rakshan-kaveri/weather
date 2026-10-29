/** WMO weather interpretation codes used by Open-Meteo. */

export type IconKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "snow"
  | "storm";

const TABLE: Record<number, { label: string; icon: IconKind }> = {
  0: { label: "Clear sky", icon: "clear" },
  1: { label: "Mainly clear", icon: "clear" },
  2: { label: "Partly cloudy", icon: "partly" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Freezing fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Heavy drizzle", icon: "drizzle" },
  56: { label: "Freezing drizzle", icon: "drizzle" },
  57: { label: "Freezing drizzle", icon: "drizzle" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "heavy-rain" },
  66: { label: "Freezing rain", icon: "rain" },
  67: { label: "Freezing rain", icon: "heavy-rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Light showers", icon: "rain" },
  81: { label: "Showers", icon: "rain" },
  82: { label: "Violent showers", icon: "heavy-rain" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Heavy snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm with hail", icon: "storm" },
  99: { label: "Severe thunderstorm with hail", icon: "storm" },
};

export function describe(code: number) {
  return TABLE[code] ?? { label: "Unknown", icon: "cloudy" as IconKind };
}

export function aqiLevel(aqi: number | null | undefined) {
  if (aqi == null) return { label: "No data", color: "#8a94a6", tip: "Air quality data is not available here." };
  if (aqi <= 50) return { label: "Good", color: "#3ecf8e", tip: "Air is clean. Great time to be outdoors." };
  if (aqi <= 100)
    return { label: "Moderate", color: "#f5c542", tip: "Acceptable. Very sensitive people should limit long outdoor exertion." };
  if (aqi <= 150)
    return {
      label: "Unhealthy for sensitive groups",
      color: "#ff9a3c",
      tip: "Children, older adults and people with asthma should reduce outdoor activity.",
    };
  if (aqi <= 200)
    return { label: "Unhealthy", color: "#ff5a5a", tip: "Everyone should limit prolonged outdoor exertion. Consider a mask." };
  if (aqi <= 300)
    return { label: "Very unhealthy", color: "#b469ff", tip: "Avoid outdoor activity. Keep windows closed." };
  return { label: "Hazardous", color: "#8b1d3b", tip: "Stay indoors and use air filtration if available." };
}

export function uvLevel(uv: number | null | undefined) {
  if (uv == null) return "—";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

export function compass(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
