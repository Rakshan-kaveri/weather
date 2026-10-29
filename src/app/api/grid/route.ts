import { handler, HttpError, json, limit, num } from "@/lib/api";
import { getGrid } from "@/lib/weather";

export const dynamic = "force-dynamic";

/** GET /api/grid?w=..&s=..&e=..&n=.. → forecast grid for the map overlays (54 hours) */
export const GET = handler(async (req: Request) => {
  limit(req, "grid", 40);
  const p = new URL(req.url).searchParams;
  const w = num(p.get("w"), "w");
  const s = num(p.get("s"), "s");
  const e = num(p.get("e"), "e");
  const n = num(p.get("n"), "n");
  if (e <= w || n <= s) throw new HttpError(400, "Invalid bounding box");
  const grid = await getGrid(w, s, e, n);
  return json(grid, { headers: { "Cache-Control": "public, max-age=900" } });
});
