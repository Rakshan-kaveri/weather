import { handler, HttpError, json, limit, num } from "@/lib/api";
import { boundariesIn } from "@/lib/boundaries";

export const dynamic = "force-dynamic";

/** GET /api/boundaries?level=2|3&w&s&e&n → district (2) or taluk (3) shapes inside the box */
export const GET = handler(async (req: Request) => {
  limit(req, "boundaries", 60);
  const p = new URL(req.url).searchParams;
  const level = Number(p.get("level"));
  if (level !== 2 && level !== 3) throw new HttpError(400, "level must be 2 or 3");
  const w = num(p.get("w"), "w");
  const s = num(p.get("s"), "s");
  const e = num(p.get("e"), "e");
  const n = num(p.get("n"), "n");
  // Keep responses small: districts only for regional views, taluks only when zoomed in.
  if (e - w > (level === 2 ? 30 : 8) || n - s > (level === 2 ? 25 : 6)) return json({ type: "FeatureCollection", features: [] });
  try {
    const fc = await boundariesIn(level, w, s, e, n);
    return json(fc, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return json({ type: "FeatureCollection", features: [], unavailable: true });
  }
});
