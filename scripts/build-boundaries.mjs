#!/usr/bin/env node
/**
 * Builds the district (ADM2) / taluk (ADM3) boundary tiles used by /api/boundaries.
 *
 *   node scripts/build-boundaries.mjs 3        # one level
 *   node scripts/build-boundaries.mjs 2 3      # both
 *
 * Source: geoBoundaries gbOpen (www.geoboundaries.org, CC BY 4.0). The country file is downloaded once,
 * simplified to 3 decimals and split into small per-area files under data/boundaries/<COUNTRY>-ADM<level>/
 * so the web server only ever reads the few files covering the visible map (low, constant memory).
 * The web server starts this script in the background automatically when the tiles are missing.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const COUNTRY = (process.env.BOUNDARY_COUNTRY || "IND").toUpperCase();
const ROOT = path.join(process.cwd(), "data", "boundaries");
const r3 = (v) => Math.round(v * 1000) / 1000;
export const cellSize = (level) => (level === 2 ? 2 : 1);

async function download(level) {
  // Re-use the older single-file cache if a previous version already downloaded it
  const legacy = path.join(ROOT, `${COUNTRY}-ADM${level}.json`);
  try {
    const compact = JSON.parse(await fs.readFile(legacy, "utf8"));
    if (Array.isArray(compact) && compact.length) return { compact, legacy };
  } catch {}
  const meta = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${COUNTRY}/ADM${level}/`, { signal: AbortSignal.timeout(30000) });
  if (!meta.ok) throw new Error(`geoBoundaries ${meta.status}`);
  const m = await meta.json();
  const url = m.simplifiedGeometryGeoJSON || m.gjDownloadURL;
  if (!url) throw new Error("geoBoundaries: no download URL");
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`geoBoundaries file ${res.status}`);
  return { geojson: await res.json() };
}

function toCompact(fc) {
  const out = [];
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    if (!polys.length) continue;
    let w = 180, s = 90, e = -180, n = -90;
    let best = [];
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
    const cx = best.reduce((a, p) => a + p[0], 0) / Math.max(1, best.length);
    const cy = best.reduce((a, p) => a + p[1], 0) / Math.max(1, best.length);
    const p = f.properties ?? {};
    out.push({ n: String(p.shapeName ?? p.name ?? ""), b: [w, s, e, n], c: [r3(cx), r3(cy)], g: g2 });
  }
  return out;
}

async function build(level) {
  const dir = path.join(ROOT, `${COUNTRY}-ADM${level}`);
  try {
    await fs.access(path.join(dir, "index.json"));
    console.log(`[boundaries] ADM${level} already built`);
    return;
  } catch {}
  console.log(`[boundaries] building ADM${level} tiles…`);
  const src = await download(level);
  const features = src.compact ?? toCompact(src.geojson);
  const size = cellSize(level);
  const cells = new Map();
  features.forEach((f, id) => {
    const [w, s, e, n] = f.b;
    for (let x = Math.floor(w / size); x <= Math.floor(e / size); x++) {
      for (let y = Math.floor(s / size); y <= Math.floor(n / size); y++) {
        const key = `${x}_${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push({ id, ...f });
      }
    }
  });
  const tmp = `${dir}.tmp`;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  for (const [key, list] of cells) await fs.writeFile(path.join(tmp, `${key}.json`), JSON.stringify(list));
  await fs.writeFile(path.join(tmp, "index.json"), JSON.stringify({ level, size, count: features.length, cells: [...cells.keys()], builtAt: new Date().toISOString() }));
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rename(tmp, dir);
  if (src.legacy) await fs.rm(src.legacy, { force: true });
  console.log(`[boundaries] ADM${level}: ${features.length} shapes in ${cells.size} tiles`);
}

const levels = process.argv.slice(2).map(Number).filter((l) => l === 2 || l === 3);
for (const level of levels.length ? levels : [2, 3]) {
  try {
    await build(level);
  } catch (e) {
    console.error(`[boundaries] ADM${level} failed:`, e?.message ?? e);
    process.exitCode = 1;
  }
}
