import { handler, json, limit, num } from "@/lib/api";
import { getAirQuality, getForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";

/** GET /api/weather?lat=..&lon=.. → current, hourly, 8-day forecast and air quality */
export const GET = handler(async (req: Request) => {
  limit(req, "weather", 120);
  const url = new URL(req.url);
  const lat = num(url.searchParams.get("lat"), "lat");
  const lon = num(url.searchParams.get("lon"), "lon");
  const [forecast, air] = await Promise.all([getForecast(lat, lon), getAirQuality(lat, lon).catch(() => null)]);
  return json({ forecast, air }, { headers: { "Cache-Control": "public, max-age=300" } });
});
