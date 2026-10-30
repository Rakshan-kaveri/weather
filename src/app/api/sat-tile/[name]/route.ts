import { HttpError, handler, limit } from "@/lib/api";

export const dynamic = "force-dynamic";

const EUMETVIEW = "https://view.eumetsat.int/geoserver/wms";

// Recently served tiles (~30 KB each): many visitors look at the same frames, so keep a few hundred in memory.
const cache = new Map<string, { body: ArrayBuffer; type: string }>();
const CACHE_MAX = 600;

/**
 * GET /api/sat-tile/tile.png?layer=&time=&bbox=  (the ".png" path lets Cloudflare cache it at the edge)
 *  → one 256×256 EUMETSAT (Meteosat) cloud tile.
 * The WebGL map can only draw images served with CORS headers, so EUMETSAT's open WMS tiles are passed
 * through here. Frames for a given time never change, so browsers and Cloudflare may cache them for a day.
 */
export const GET = handler(async (req: Request) => {
  limit(req, "sat-tile", 2000);
  const p = new URL(req.url).searchParams;
  const layer = p.get("layer") ?? "";
  const time = p.get("time") ?? "";
  const bbox = (p.get("bbox") ?? "").split(",").map(Number);
  if (!/^[\w:.-]{3,80}$/.test(layer)) throw new HttpError(400, "bad layer");
  if (!/^\d{4}-\d\d-\d\d(T[\d:.]+Z?)?$/.test(time)) throw new HttpError(400, "bad time");
  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v) || Math.abs(v) > 2.1e7)) throw new HttpError(400, "bad bbox");

  const q = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    version: "1.3.0",
    layers: layer,
    styles: "",
    format: "image/png",
    transparent: "true",
    crs: "EPSG:3857",
    width: "256",
    height: "256",
    bbox: bbox.join(","),
    time,
  });
  const key = q.toString();
  let hit = cache.get(key);
  if (!hit) {
    const res = await fetch(`${EUMETVIEW}?${q}`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    const type = res?.headers.get("content-type") ?? "";
    if (!res || !res.ok || !type.startsWith("image/")) throw new HttpError(502, "tile unavailable");
    hit = { body: await res.arrayBuffer(), type };
    cache.set(key, hit);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return new Response(hit.body, {
    headers: { "Content-Type": hit.type, "Cache-Control": "public, max-age=86400, immutable", "Access-Control-Allow-Origin": "*" },
  });
});
