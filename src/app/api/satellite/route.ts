import { handler, json } from "@/lib/api";
import { cached } from "@/lib/cache";
import { satelliteSources } from "@/lib/satellite";

export const dynamic = "force-dynamic";

/** GET /api/satellite → live satellite sources with their latest animation frames */
export const GET = handler(async () => {
  const sources = await cached("sat:sources", 300, satelliteSources);
  return json({ sources }, { headers: { "Cache-Control": "public, max-age=120" } });
});
