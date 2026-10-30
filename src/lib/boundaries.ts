import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * District (ADM2) and sub-district / taluk (ADM3) boundaries from geoBoundaries (www.geoboundaries.org, CC BY 4.0).
 *
 * The country file is large, so it is never held in the web server's memory. scripts/build-boundaries.mjs
 * (started automatically in a separate process the first time) splits it into small per-area files, and each
 * request reads only the files covering the visible map. A small LRU keeps recently used tiles in memory.
 */

type Feature = { id: number; n: string; b: [number, number, number, number]; c: [number, number]; g: number[][][][] };
type Level = 2 | 3;

const COUNTRY = (process.env.BOUNDARY_COUNTRY || "IND").toUpperCase();
const ROOT = path.join(process.cwd(), "data", "boundaries");
const cellSize = (level: Level) => (level === 2 ? 2 : 1);
const dirFor = (level: Level) => path.join(ROOT, `${COUNTRY}-ADM${level}`);

const ready = new Map<Level, Set<string>>(); // level → cells that exist
let building: Promise<void> | null = null;

function buildInBackground(): Promise<void> {
  if (!building) {
    building = new Promise<void>((resolve) => {
      const child = spawn(process.execPath, ["--max-old-space-size=900", path.join(process.cwd(), "scripts", "build-boundaries.mjs"), "2", "3"], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: process.env,
      });
      child.on("exit", () => resolve());
      child.on("error", () => resolve());
    }).finally(() => {
      // allow another attempt later if it failed
      setTimeout(() => (building = null), 10 * 60_000).unref?.();
    });
  }
  return building;
}

async function cellsFor(level: Level): Promise<Set<string> | null> {
  const known = ready.get(level);
  if (known) return known;
  try {
    const idx = JSON.parse(await fs.readFile(path.join(dirFor(level), "index.json"), "utf8")) as { cells: string[] };
    const set = new Set(idx.cells);
    ready.set(level, set);
    return set;
  } catch {
    void buildInBackground();
    return null;
  }
}

const lru = new Map<string, Feature[]>();
const LRU_MAX = 80;

async function readCell(level: Level, key: string): Promise<Feature[]> {
  const k = `${level}:${key}`;
  const hit = lru.get(k);
  if (hit) {
    lru.delete(k);
    lru.set(k, hit);
    return hit;
  }
  const list = JSON.parse(await fs.readFile(path.join(dirFor(level), `${key}.json`), "utf8")) as Feature[];
  lru.set(k, list);
  if (lru.size > LRU_MAX) lru.delete(lru.keys().next().value!);
  return list;
}

/** Features of a level intersecting the box, as a GeoJSON FeatureCollection with name + label point. */
export async function boundariesIn(level: Level, w: number, s: number, e: number, n: number, max = 600) {
  const cells = await cellsFor(level);
  if (!cells) throw new Error("boundaries not built yet");
  const size = cellSize(level);
  const seen = new Set<number>();
  const features = [];
  for (let x = Math.floor(w / size); x <= Math.floor(e / size); x++) {
    for (let y = Math.floor(s / size); y <= Math.floor(n / size); y++) {
      const key = `${x}_${y}`;
      if (!cells.has(key)) continue;
      for (const f of await readCell(level, key)) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        if (f.b[2] < w || f.b[0] > e || f.b[3] < s || f.b[1] > n) continue;
        features.push({ type: "Feature", properties: { name: f.n, label: f.c }, geometry: { type: "MultiPolygon", coordinates: f.g } });
        if (features.length >= max) return { type: "FeatureCollection", features };
      }
    }
  }
  return { type: "FeatureCollection", features };
}

/** On startup: make sure the tiles exist (building them in a separate process if not). Loads nothing into memory. */
export function preloadBoundaries() {
  void cellsFor(2).then((c) => (c ? cellsFor(3) : null));
}
