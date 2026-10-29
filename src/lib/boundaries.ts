import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * District (ADM2) and sub-district / taluk (ADM3) boundaries from geoBoundaries (www.geoboundaries.org, CC BY 4.0).
 * Downloaded once on first use, converted to a compact form and stored under ./data, then served by bounding box
 * so the browser only ever receives the shapes that are on screen.
 */

type Compact = { n: string; b: [number, number, number, number]; c: [number, number]; g: number[][][][] };
type Level = 2 | 3;

const COUNTRY = (process.env.BOUNDARY_COUNTRY || "IND").toUpperCase();
const DATA_DIR = path.join(process.cwd(), "data", "boundaries");
const memory = new Map<Level, Promise<Compact[]>>();

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function toCompact(fc: { features?: { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } }[] }): Compact[] {
  const out: Compact[] = [];
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    const polys = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as number[][][][];
    if (!polys.length) continue;
    let w = 180, s = 90, e = -180, n = -90;
    let best: number[][] = [];
    const g2 = polys.map((poly) =>
      poly.map((ring) => {
        const rr = ring.map(([x, y]) => {
          if (x < w) w = x;
          if (x > e) e = x;
          if (y < s) s = y;
          if (y > n) n = y;
          return [r3(x), r3(y)];
        });
        if (rr.length > best.length) best = rr;
        return rr;
      }),
    );
    // label point: average of the largest ring's vertices (good enough for district-sized shapes)
    const cx = best.reduce((a, p) => a + p[0], 0) / Math.max(1, best.length);
    const cy = best.reduce((a, p) => a + p[1], 0) / Math.max(1, best.length);
    const p = f.properties ?? {};
    out.push({ n: String(p.shapeName ?? p.name ?? ""), b: [w, s, e, n], c: [r3(cx), r3(cy)], g: g2 });
  }
  return out;
}

async function download(level: Level): Promise<Compact[]> {
  const meta = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${COUNTRY}/ADM${level}/`, { signal: AbortSignal.timeout(20000) });
  if (!meta.ok) throw new Error(`geoBoundaries ${meta.status}`);
  const m = (await meta.json()) as { simplifiedGeometryGeoJSON?: string; gjDownloadURL?: string };
  const url = m.simplifiedGeometryGeoJSON || m.gjDownloadURL;
  if (!url) throw new Error("geoBoundaries: no download URL");
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`geoBoundaries file ${res.status}`);
  return toCompact(await res.json());
}

function load(level: Level): Promise<Compact[]> {
  let p = memory.get(level);
  if (!p) {
    p = (async () => {
      const file = path.join(DATA_DIR, `${COUNTRY}-ADM${level}.json`);
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as Compact[];
      } catch {
        const data = await download(level);
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(file, JSON.stringify(data));
        return data;
      }
    })();
    p.catch(() => memory.delete(level)); // retry on the next request if the download failed
    memory.set(level, p);
  }
  return p;
}

/** Features of a level intersecting the box, as a GeoJSON FeatureCollection with name + label point. */
export async function boundariesIn(level: Level, w: number, s: number, e: number, n: number, max = 600) {
  const all = await load(level);
  const features = [];
  for (const f of all) {
    if (f.b[2] < w || f.b[0] > e || f.b[3] < s || f.b[1] > n) continue;
    features.push({
      type: "Feature",
      properties: { name: f.n, label: f.c },
      geometry: { type: "MultiPolygon", coordinates: f.g },
    });
    if (features.length >= max) break;
  }
  return { type: "FeatureCollection", features };
}

/** Start downloading in the background so the first map visitor doesn't wait. */
export function preloadBoundaries() {
  load(2).catch(() => {});
  load(3).catch(() => {});
}
