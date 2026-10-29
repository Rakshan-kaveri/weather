import { handler, json, limit, num } from "@/lib/api";
import { getHistory } from "@/lib/weather";

export const dynamic = "force-dynamic";

/** GET /api/history?lat=..&lon=.. → last 7 days (daily max/min, rain, wind) */
export const GET = handler(async (req: Request) => {
  limit(req, "history", 60);
  const url = new URL(req.url);
  const days = await getHistory(num(url.searchParams.get("lat"), "lat"), num(url.searchParams.get("lon"), "lon"));
  return json({ days }, { headers: { "Cache-Control": "public, max-age=1800" } });
});
