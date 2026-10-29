import { handler, json, limit } from "@/lib/api";
import { searchPlaces } from "@/lib/weather";

export const dynamic = "force-dynamic";

/** GET /api/geocode?q=manipal → matching places */
export const GET = handler(async (req: Request) => {
  limit(req, "geocode", 60);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ results: await searchPlaces(q) });
});
