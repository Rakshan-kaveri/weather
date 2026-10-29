import { handler, json, limit, num } from "@/lib/api";
import { reverseGeocode } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** GET /api/reverse?lat=..&lon=.. → place name for a coordinate */
export const GET = handler(async (req: Request) => {
  limit(req, "reverse", 30);
  const url = new URL(req.url);
  return json(await reverseGeocode(num(url.searchParams.get("lat"), "lat"), num(url.searchParams.get("lon"), "lon")));
});
