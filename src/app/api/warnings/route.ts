import { handler, json, limit, num } from "@/lib/api";
import { warningsFor } from "@/lib/severe";

export const dynamic = "force-dynamic";

/** GET /api/warnings?lat=..&lon=.. → active severe-weather warnings (thunderstorm, heavy rain, wind, cyclone) */
export const GET = handler(async (req: Request) => {
  limit(req, "warnings", 120);
  const url = new URL(req.url);
  const warnings = await warningsFor(num(url.searchParams.get("lat"), "lat"), num(url.searchParams.get("lon"), "lon"));
  return json({ warnings }, { headers: { "Cache-Control": "public, max-age=300" } });
});
