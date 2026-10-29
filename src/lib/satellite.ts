import { cached } from "./cache";

/**
 * Live satellite imagery sources for the animated "clouds moving" view.
 *  - EUMETSAT EUMETView WMS (free, public): Meteosat over the Indian Ocean (IODC, 45.5°E, scans every 15 min)
 *    and the global geostationary IR cloud mosaic. Layer names and available times are read from the live
 *    GetCapabilities document, so the frames always match what EUMETSAT has actually published.
 *  - NASA GIBS: JMA Himawari infrared (10-minute scans) as a fallback, and the daily VIIRS true-colour mosaic.
 */

export type SatSource = {
  id: "iodc" | "global" | "himawari" | "truecolor";
  label: string;
  note: string;
  kind: "wms" | "xyz";
  url: string;
  layer?: string;
  frames: string[]; // ISO times, oldest → newest
  maxNativeZoom: number;
  opacity: number;
  attribution: string;
};

const EUMETVIEW = "https://view.eumetsat.int/geoserver/wms";
const MAX_FRAMES = 12;

type CapLayer = { name: string; title: string; times: string };

async function eumetviewLayers(): Promise<CapLayer[]> {
  return cached("eumetview:caps", 1800, async () => {
    const res = await fetch(`${EUMETVIEW}?service=WMS&version=1.3.0&request=GetCapabilities`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`EUMETView ${res.status}`);
    const xml = await res.text();
    const out: CapLayer[] = [];
    const re = /<Layer\b[^>]*>\s*<Name>([^<]+)<\/Name>\s*<Title>([^<]*)<\/Title>([\s\S]*?)(?=<Layer\b[^>]*>\s*<Name>|<\/Capability>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const dim = /<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i.exec(m[3]);
      out.push({ name: m[1].trim(), title: m[2].trim(), times: dim?.[1]?.trim() ?? "" });
    }
    return out;
  });
}

function parsePeriodMs(p: string) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(p);
  if (!m) return 0;
  return ((+(m[1] ?? 0) * 24 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0)) * 60_000 + +(m[4] ?? 0) * 1000;
}

/** Turns a WMS time dimension ("t1,t2,…" or "start/end/PT15M") into the latest N frame times. */
export function latestFrames(dim: string, n = MAX_FRAMES): string[] {
  if (!dim) return [];
  const now = Date.now();
  const times: number[] = [];
  for (const part of dim.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("/")) {
      const [a, b, per] = p.split("/");
      const start = Date.parse(a);
      const end = Math.min(Date.parse(b), now);
      const step = parsePeriodMs(per);
      if (!step || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let t = end - ((end - start) % step); t >= start && times.length < n * 4; t -= step) times.push(t);
    } else {
      const t = Date.parse(p);
      if (Number.isFinite(t) && t <= now) times.push(t);
    }
  }
  return [...new Set(times)]
    .sort((a, b) => a - b)
    .slice(-n)
    .map((t) => new Date(t).toISOString().replace(".000Z", "Z"));
}

function himawariFrames(n = 18) {
  const t = new Date(Date.now() - 50 * 60_000);
  t.setUTCMinutes(Math.floor(t.getUTCMinutes() / 10) * 10, 0, 0);
  return Array.from({ length: n }, (_, i) => new Date(t.getTime() - (n - 1 - i) * 10 * 60_000).toISOString().slice(0, 19) + "Z");
}

export async function satelliteSources(): Promise<SatSource[]> {
  const sources: SatSource[] = [];
  let layers: CapLayer[] = [];
  try {
    layers = await eumetviewLayers();
  } catch {
    /* EUMETView unreachable — fall back to NASA sources */
  }

  const iodc =
    layers.find((l) => /iodc/i.test(l.name) && /ir_?108|10\.8/i.test(l.name + l.title) && l.times) ??
    layers.find((l) => /iodc/i.test(l.name) && /ir/i.test(l.name) && l.times);
  if (iodc) {
    const frames = latestFrames(iodc.times);
    if (frames.length)
      sources.push({
        id: "iodc",
        label: "Live clouds · India",
        note: "Meteosat Indian Ocean (EUMETSAT) infrared · every 15 min",
        kind: "wms",
        url: EUMETVIEW,
        layer: iodc.name,
        frames,
        maxNativeZoom: 7,
        opacity: 0.85,
        attribution: "© EUMETSAT",
      });
  }

  sources.push({
    id: "himawari",
    label: iodc ? "Live clouds · Asia-Pacific" : "Live clouds",
    note: "JMA Himawari infrared via NASA GIBS · every 10 min",
    kind: "xyz",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/all/Himawari_AHI_Band13_Clean_Infrared_v0_NRT_ZENJPEG/default/{time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.jpg",
    frames: himawariFrames(),
    maxNativeZoom: 6,
    opacity: 0.8,
    attribution: "NASA GIBS · JMA Himawari",
  });

  const global = layers.find((l) => l.name === "mumi:worldcloudmap_ir108") ?? layers.find((l) => /worldcloudmap/i.test(l.name));
  if (global) {
    const frames = latestFrames(global.times, 8);
    sources.push({
      id: "global",
      label: "Global clouds",
      note: "EUMETSAT multi-satellite infrared mosaic · every 3 h",
      kind: "wms",
      url: EUMETVIEW,
      layer: global.name,
      frames: frames.length ? frames : [""],
      maxNativeZoom: 6,
      opacity: 0.8,
      attribution: "© EUMETSAT",
    });
  }

  const d = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
  sources.push({
    id: "truecolor",
    label: "True colour (daily)",
    note: `NASA VIIRS true-colour mosaic · ${d}`,
    kind: "xyz",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    frames: [d],
    maxNativeZoom: 9,
    opacity: 0.95,
    attribution: "NASA EOSDIS GIBS",
  });
  return sources;
}
