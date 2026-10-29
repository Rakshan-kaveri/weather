import { handler, json, limit } from "@/lib/api";
import { cycloneTrack } from "@/lib/severe";

export const dynamic = "force-dynamic";

/** GET /api/cyclones/track?id=..&episode=.. → past track, forecast track and wind areas (GDACS) */
export const GET = handler(async (req: Request) => {
  limit(req, "cyclone-track", 60);
  const p = new URL(req.url).searchParams;
  const features = await cycloneTrack(p.get("id") ?? "", p.get("episode")).catch(() => []);
  return json({ features }, { headers: { "Cache-Control": "public, max-age=900" } });
});
