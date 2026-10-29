"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { usePrefs } from "../Providers";
import { LAYERS, cssGradient, layerById, makeScale, sample, windComponents, type LayerId } from "@/lib/mapLayers";
import type { GridData } from "@/lib/weather";
import { temp as fmtTemp, wind as fmtWind } from "@/lib/units";
import { SearchBox, type PickedPlace } from "./SearchBox";
import { PointPanel } from "./PointPanel";
import { toast } from "../Toast";
import type { SatSource } from "@/lib/satellite";

type RadarFrame = { time: number; url: string };
type Selected = { lat: number; lon: number; name?: string; region?: string; country?: string };

const INDIA: [number, number] = [21.5, 79];
const LAYER_KEY = "skycast:layer";

type Cyclone = { id: string; name: string; alertLevel: "Green" | "Orange" | "Red"; lat: number; lon: number; severity: string; link: string };

export default function MapExplorer() {
  const { prefs } = usePrefs();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const flowRef = useRef<HTMLCanvasElement | null>(null);
  const satLayers = useRef<L.TileLayer[]>([]);
  const cycloneLayer = useRef<L.LayerGroup | null>(null);
  const radarLayers = useRef<L.TileLayer[]>([]);
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number>(0);
  const gridKey = useRef("");

  const [layer, setLayer] = useState<LayerId>("wind");
  const [satSources, setSatSources] = useState<SatSource[]>([]);
  const [satId, setSatId] = useState<SatSource["id"] | null>(null);
  const [satIdx, setSatIdx] = useState(0);
  const [cyclones, setCyclones] = useState<Cyclone[]>([]);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [timeIdx, setTimeIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [radar, setRadar] = useState<RadarFrame[]>([]);
  const [radarIdx, setRadarIdx] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [viewTick, setViewTick] = useState(0);

  const def = layerById(layer);

  /* ─── Map setup ───────────────────────────────────────── */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const qlat = Number(params.get("lat"));
    const qlon = Number(params.get("lon"));
    const hasQuery = params.has("lat") && Number.isFinite(qlat) && Number.isFinite(qlon);
    try {
      const saved = localStorage.getItem(LAYER_KEY) as LayerId | null;
      const q = params.get("layer") as LayerId | null;
      const pick = q ?? saved;
      if (pick && LAYERS.some((l) => l.id === pick)) setLayer(pick);
    } catch {
      /* ignore */
    }

    const map = L.map(mapEl.current, {
      center: hasQuery ? [qlat, qlon] : INDIA,
      zoom: hasQuery ? 8 : 5,
      minZoom: 3,
      maxZoom: 15,
      zoomControl: false,
      worldCopyJump: true,
      maxBounds: [
        [-85, -360],
        [85, 360],
      ],
    });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Base imagery
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 15,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(map);

    // Live satellite frames (EUMETSAT / NASA) are added on the Satellite layer
    map.createPane("sat").style.zIndex = "250";
    map.createPane("cyclones").style.zIndex = "620";
    cycloneLayer.current = L.layerGroup([], { pane: "cyclones" }).addTo(map);

    // Overlay panes for the weather canvases, under the place labels
    const heatPane = map.createPane("heat");
    heatPane.style.zIndex = "350";
    heatPane.style.pointerEvents = "none";
    const flowPane = map.createPane("flow");
    flowPane.style.zIndex = "360";
    flowPane.style.pointerEvents = "none";
    heatRef.current = L.DomUtil.create("canvas", "", heatPane) as HTMLCanvasElement;
    flowRef.current = L.DomUtil.create("canvas", "", flowPane) as HTMLCanvasElement;
    map.createPane("radar").style.zIndex = "340";

    // Labels & borders on top of everything
    map.createPane("labels").style.zIndex = "450";
    map.getPane("labels")!.style.pointerEvents = "none";
    // Borders and place names (Esri reference layer, no API key needed)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      pane: "labels",
      maxZoom: 15,
      attribution: "Labels © Esri",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => setSelected({ lat: e.latlng.lat, lon: e.latlng.lng }));
    map.on("zoomstart", () => {
      if (heatRef.current) heatRef.current.style.visibility = "hidden";
      if (flowRef.current) flowRef.current.style.visibility = "hidden";
    });
    map.on("moveend zoomend resize", () => setViewTick((t) => t + 1));

    if (hasQuery) setSelected({ lat: qlat, lon: qlon, name: params.get("name") ?? undefined });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAYER_KEY, layer);
    } catch {
      /* ignore */
    }
  }, [layer]);

  /* ─── Selected point marker ───────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!selected) return;
    markerRef.current = L.marker([selected.lat, selected.lon], {
      icon: L.divIcon({ className: "", html: '<div class="pin-pulse"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
      keyboard: false,
    }).addTo(map);
  }, [selected]);

  /* ─── Live satellite clouds ───────────────────────────── */
  useEffect(() => {
    if (layer !== "satellite" || satSources.length) return;
    fetch("/api/satellite")
      .then((r) => r.json())
      .then((d: { sources: SatSource[] }) => {
        setSatSources(d.sources ?? []);
        setSatId((id) => id ?? d.sources?.[0]?.id ?? null);
      })
      .catch(() => {});
  }, [layer, satSources.length]);

  const sat = satSources.find((x) => x.id === satId) ?? null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    satLayers.current.forEach((l) => l.remove());
    satLayers.current = [];
    if (layer !== "satellite" || !sat) return;
    // One tile layer per frame, all loaded up front, so playback is smooth (clouds visibly move).
    satLayers.current = sat.frames.map((time) =>
      sat.kind === "wms"
        ? L.tileLayer
            .wms(sat.url, {
              pane: "sat",
              layers: sat.layer!,
              format: "image/png",
              transparent: true,
              version: "1.3.0",
              opacity: 0,
              maxNativeZoom: sat.maxNativeZoom,
              maxZoom: 15,
              attribution: sat.attribution,
              ...(time ? { time } : {}),
            } as L.WMSOptions)
            .addTo(map)
        : L.tileLayer(sat.url, { pane: "sat", opacity: 0, maxNativeZoom: sat.maxNativeZoom, maxZoom: 15, attribution: sat.attribution, time } as L.TileLayerOptions).addTo(map),
    );
    setSatIdx(sat.frames.length - 1);
    if (sat.frames.length > 1) setPlaying(true);
  }, [layer, sat]);

  useEffect(() => {
    if (!sat) return;
    satLayers.current.forEach((l, i) => l.setOpacity(i === satIdx ? sat.opacity : 0));
  }, [satIdx, sat]);

  /* ─── Active cyclones (GDACS) — shown on every layer ─── */
  useEffect(() => {
    const load = () =>
      fetch("/api/cyclones")
        .then((r) => r.json())
        .then((d: { cyclones: Cyclone[] }) => setCyclones(d.cyclones ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const group = cycloneLayer.current;
    if (!group) return;
    group.clearLayers();
    const color = { Green: "#3ecf8e", Orange: "#ff9a3c", Red: "#ff5a5a" };
    for (const c of cyclones) {
      const icon = L.divIcon({
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `<div class="cyclone-marker" style="--c:${color[c.alertLevel]}"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2"/><path d="M5 9c2-5 9-6 12-2M19 15c-2 5-9 6-12 2M9 4c-4 3-4 9 0 11M15 20c4-3 4-9 0-11"/></svg></div>`,
      });
      L.marker([c.lat, c.lon], { icon, pane: "cyclones", title: c.name })
        .bindPopup(
          `<strong>Cyclone ${escapeHtml(c.name)}</strong><br>${c.alertLevel} alert${c.severity ? ` · ${escapeHtml(c.severity)}` : ""}<br><a href="${c.link}" target="_blank" rel="noreferrer">Track & impact (GDACS)</a>`,
        )
        .addTo(group);
    }
  }, [cyclones]);

  /* ─── Forecast grid for the visible area ──────────────── */
  const loadGrid = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const w = Math.max(-180, b.getWest());
    const e = Math.min(180, b.getEast());
    const s = Math.max(-85, b.getSouth());
    const n = Math.min(85, b.getNorth());
    if (e <= w || n <= s) return;
    setGridLoading(true);
    try {
      const res = await fetch(`/api/grid?w=${w.toFixed(2)}&s=${s.toFixed(2)}&e=${e.toFixed(2)}&n=${n.toFixed(2)}`);
      if (!res.ok) return;
      const g: GridData = await res.json();
      const key = g.bbox.join(",") + g.cols + "x" + g.rows;
      if (key === gridKey.current) return;
      gridKey.current = key;
      // keep the same wall-clock hour when the grid is replaced
      const prevTime = gridRef.current?.times[timeIdxRef.current];
      const idx = prevTime ? g.times.indexOf(prevTime) : -1;
      gridRef.current = g;
      setGrid(g);
      setTimeIdx(idx >= 0 ? idx : nowIndex(g.times));
    } catch {
      /* network hiccup: keep the old grid */
    } finally {
      setGridLoading(false);
    }
  }, []);

  const timeIdxRef = useRef(0);
  timeIdxRef.current = timeIdx;
  const gridRef = useRef<GridData | null>(null);

  useEffect(() => {
    if (!def.gridVar) return;
    const t = setTimeout(loadGrid, 350);
    return () => clearTimeout(t);
  }, [viewTick, def.gridVar, loadGrid]);

  /* ─── Heat map + value labels ─────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    const canvas = heatRef.current;
    if (!map || !canvas) return;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.style.visibility = "visible";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    if (!grid || !def.gridVar || !def.stops) return;
    const values = grid.values[def.gridVar][Math.min(timeIdx, grid.times.length - 1)];
    if (!values) return;

    const step = 4;
    const w = Math.ceil(size.x / step);
    const h = Math.ceil(size.y / step);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(w, h);
    const scale = makeScale(def.stops);
    const lons = new Float64Array(w);
    const lats = new Float64Array(h);
    for (let x = 0; x < w; x++) lons[x] = wrapLon(map.containerPointToLatLng([x * step, 0]).lng);
    for (let y = 0; y < h; y++) lats[y] = map.containerPointToLatLng([0, y * step]).lat;
    const alpha = def.opacity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = sample(grid, values, lats[y], lons[x]);
        if (Number.isNaN(v)) continue;
        const [r, g, b, a] = scale(v);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = a * alpha;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, w * step, h * step);

    if (def.labels) {
      ctx.font = "600 11px \"Inter Variable\", Inter, system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const [gw, , , gn] = grid.bbox;
      const dx = (grid.bbox[2] - gw) / (grid.cols - 1);
      const dy = (gn - grid.bbox[1]) / (grid.rows - 1);
      const minGapX = 120;
      const minGapY = 80;
      const last: { x: number; y: number }[] = [];
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const p = map.latLngToContainerPoint([gn - r * dy, gw + c * dx]);
          if (p.x < 20 || p.y < 70 || p.x > size.x - 20 || p.y > size.y - 90) continue;
          if (last.some((q) => Math.abs(q.x - p.x) < minGapX && Math.abs(q.y - p.y) < minGapY)) continue;
          last.push(p);
          const v = values[r * grid.cols + c];
          const text =
            layer === "temp" ? fmtTemp(v, prefs.tempUnit) : layer === "wind" ? fmtWind(v, prefs.windUnit).split(" ")[0] : String(Math.round(v));
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          const tw = ctx.measureText(text).width + 10;
          roundRect(ctx, p.x - tw / 2, p.y - 9, tw, 18, 9);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(text, p.x, p.y + 0.5);
        }
      }
    }
  }, [grid, timeIdx, layer, def, viewTick, prefs.tempUnit, prefs.windUnit]);

  /* ─── Animated wind particles ─────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    const canvas = flowRef.current;
    cancelAnimationFrame(rafRef.current);
    if (!map || !canvas) return;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.style.visibility = "visible";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    if (layer !== "wind" || !grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { u, v } = windComponents(grid, Math.min(timeIdx, grid.times.length - 1));
    const count = Math.round(Math.min(3000, (size.x * size.y) / 500));
    const spawn = () => ({ x: Math.random() * size.x, y: Math.random() * size.y, age: Math.floor(Math.random() * 80), max: 60 + Math.random() * 60 });
    const particles = Array.from({ length: count }, spawn);
    const k = 0.05;

    const frame = () => {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const ll = map.containerPointToLatLng([p.x, p.y]);
        const lon = wrapLon(ll.lng);
        const uu = sample(grid, u, ll.lat, lon);
        const vv = sample(grid, v, ll.lat, lon);
        if (Number.isNaN(uu) || p.age++ > p.max) {
          particles[i] = { ...spawn(), age: 0 };
          continue;
        }
        const nx = p.x + uu * k;
        const ny = p.y - vv * k;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        p.x = nx;
        p.y = ny;
        if (nx < 0 || ny < 0 || nx > size.x || ny > size.y) particles[i] = { ...spawn(), age: 0 };
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    const stop = () => cancelAnimationFrame(rafRef.current);
    map.on("movestart zoomstart", stop);
    return () => {
      stop();
      map.off("movestart zoomstart", stop);
    };
  }, [grid, timeIdx, layer, viewTick]);

  /* ─── Radar ───────────────────────────────────────────── */
  useEffect(() => {
    if (layer !== "radar" || radar.length) return;
    fetch("/api/radar")
      .then((r) => r.json())
      .then((d: { frames: RadarFrame[] }) => {
        setRadar(d.frames);
        setRadarIdx(Math.max(0, d.frames.length - 1));
      })
      .catch(() => {});
  }, [layer, radar.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    radarLayers.current.forEach((l) => l.remove());
    radarLayers.current = [];
    if (layer !== "radar") return;
    radarLayers.current = radar.map((f) =>
      L.tileLayer(f.url, { pane: "radar", opacity: 0, maxNativeZoom: 7, maxZoom: 15, attribution: "Radar © RainViewer" }).addTo(map),
    );
  }, [layer, radar]);

  useEffect(() => {
    radarLayers.current.forEach((l, i) => l.setOpacity(i === radarIdx ? 0.85 : 0));
  }, [radarIdx, radar, layer]);

  /* ─── Playback ────────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (layer === "radar") setRadarIdx((i) => (radar.length ? (i + 1) % radar.length : 0));
      else if (layer === "satellite") setSatIdx((i) => (sat?.frames.length ? (i + 1) % sat.frames.length : 0));
      else if (grid) setTimeIdx((i) => (i + 1) % grid.times.length);
    }, layer === "radar" || layer === "satellite" ? 600 : 900);
    return () => clearInterval(t);
  }, [playing, layer, grid, radar.length, sat]);

  /* ─── Actions ─────────────────────────────────────────── */
  const flyTo = (p: PickedPlace) => {
    mapRef.current?.flyTo([p.lat, p.lon], 9, { duration: 1.2 });
    setSelected({ lat: p.lat, lon: p.lon, name: p.name, region: p.region, country: p.country });
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => flyTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "" }),
      () => alertOnce(),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const timeline = useMemo(() => {
    if (layer === "radar") {
      return {
        count: radar.length,
        idx: radarIdx,
        set: setRadarIdx,
        label: radar[radarIdx] ? fmtTime(radar[radarIdx].time * 1000) : "Loading radar…",
        note: "Past 2 hours",
      };
    }
    if (layer === "satellite") {
      if (!sat) return { count: 0, idx: 0, set: setSatIdx, label: "Loading live satellite…", note: "" };
      const t = sat.frames[satIdx];
      const ms = t && t.length > 10 ? Date.parse(t) : NaN;
      return {
        count: sat.frames.length,
        idx: satIdx,
        set: setSatIdx,
        label: Number.isFinite(ms) ? fmtTime(ms) : sat.label,
        note: sat.note,
      };
    }
    return {
      count: grid?.times.length ?? 0,
      idx: timeIdx,
      set: setTimeIdx,
      label: grid ? fmtTime(Date.parse(grid.times[timeIdx])) : "Loading forecast…",
      note: grid ? relHours(Date.parse(grid.times[timeIdx])) : "",
    };
  }, [layer, radar, radarIdx, grid, timeIdx, sat, satIdx]);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={mapEl} className="absolute inset-0" aria-label="Interactive weather map" role="application" />

      {/* Search + locate */}
      <div className="pointer-events-none absolute left-3 top-[76px] z-[1000] flex w-[min(380px,calc(100vw-24px))] gap-2">
        <div className="pointer-events-auto flex-1">
          <SearchBox onPick={flyTo} />
        </div>
        <button onClick={locate} className="glass pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-white/10" aria-label="Show my location" title="My location">
          <Icon name="locate" />
        </button>
      </div>

      {/* Layer switcher */}
      <nav
        aria-label="Map layers"
        className="glass absolute bottom-[132px] left-3 right-3 z-[1000] flex gap-1 overflow-x-auto rounded-2xl p-1.5 scrollbar-thin sm:bottom-auto sm:left-auto sm:right-3 sm:top-[76px] sm:w-[150px] sm:flex-col"
      >
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setLayer(l.id);
              setPlaying(false);
            }}
            aria-pressed={layer === l.id}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
              layer === l.id ? "bg-white text-black" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon name={l.icon} size={17} />
            <span>{l.label}</span>
          </button>
        ))}
      </nav>

      {/* Legend */}
      {def.stops && (
        <div className="glass absolute bottom-[132px] right-3 z-[999] hidden w-60 rounded-xl px-3 py-2 sm:bottom-[96px] sm:right-16 sm:block">
          <div className="mb-1 flex justify-between text-[11px] text-white/70">
            <span>{def.label}</span>
            <span>{legendUnit(layer, prefs)}</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: cssGradient(def.stops) }} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-white/60">
            <span>{legendValue(layer, def.stops[0][0], prefs)}</span>
            <span>{legendValue(layer, def.stops[Math.floor(def.stops.length / 2)][0], prefs)}</span>
            <span>{legendValue(layer, def.stops[def.stops.length - 1][0], prefs)}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline && (
        <div className="glass absolute bottom-3 left-3 right-3 z-[1000] rounded-2xl px-3 py-2.5 sm:left-1/2 sm:right-auto sm:w-[620px] sm:-translate-x-1/2">
          {layer === "satellite" && satSources.length > 0 && (
            <div className="mb-2 flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Satellite source">
              {satSources.map((src) => (
                <button
                  key={src.id}
                  role="tab"
                  aria-selected={src.id === satId}
                  onClick={() => {
                    setPlaying(false);
                    setSatId(src.id);
                  }}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-xs ${src.id === satId ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-40"
              disabled={timeline.count < 2}
              aria-label={playing ? "Pause" : "Play"}
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-white">{timeline.label}</span>
                <span className="shrink-0 text-xs text-white/60">
                  {gridLoading && def.gridVar ? "Updating…" : timeline.note}
                </span>
              </div>
              <input
                type="range"
                className="timeline w-full"
                min={0}
                max={Math.max(0, timeline.count - 1)}
                value={timeline.idx}
                onChange={(e) => {
                  setPlaying(false);
                  timeline.set(Number(e.target.value));
                }}
                aria-label="Time"
              />
            </div>
          </div>
        </div>
      )}
      {selected && <PointPanel point={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────── */

function alertOnce() {
  toast("Location access is blocked. Allow it in your browser to see your local weather.", "error");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function wrapLon(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function nowIndex(times: string[]) {
  const now = Date.now();
  let idx = 0;
  for (let i = 0; i < times.length; i++) if (Date.parse(times[i]) <= now) idx = i;
  return idx;
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function relHours(ms: number) {
  const h = Math.round((ms - Date.now()) / 3600_000);
  if (h === 0) return "Now";
  return h > 0 ? `+${h} h forecast` : `${h} h`;
}

function legendUnit(layer: LayerId, prefs: { tempUnit: string; windUnit: string }) {
  if (layer === "temp") return `°${prefs.tempUnit}`;
  if (layer === "wind") return { kmh: "km/h", ms: "m/s", mph: "mph", kn: "kn" }[prefs.windUnit] ?? "km/h";
  return layerById(layer).unit;
}

function legendValue(layer: LayerId, v: number, prefs: { tempUnit: "C" | "F"; windUnit: "kmh" | "ms" | "mph" | "kn" }) {
  if (layer === "temp") return fmtTemp(v, prefs.tempUnit);
  if (layer === "wind") return fmtWind(v, prefs.windUnit).split(" ")[0];
  return String(v);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
