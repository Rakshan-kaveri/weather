"use client";

import maplibregl, { type GeoJSONSource, type ImageSource, type Map as MLMap, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
import { MERC_MAX, SLOT_RADAR, SLOT_SAT, WORLD, baseStyle } from "./mapStyle";

type RadarFrame = { time: number; url: string };
type Selected = { lat: number; lon: number; name?: string; region?: string; country?: string };
type Cyclone = { id: string; episodeId: string | null; name: string; alertLevel: "Green" | "Orange" | "Red"; lat: number; lon: number; severity: string; link: string };
type TrackFeature = { kind: "past" | "forecast" | "point" | "area"; level?: string; label?: string; windKmh?: number; time?: string; geometry: GeoJSON.Geometry };
type FC = GeoJSON.FeatureCollection;

const INDIA: [number, number] = [79, 21.5]; // lon, lat
const LAYER_KEY = "skycast:layer";
const GLOBE_KEY = "skycast:globe";

export default function MapExplorer() {
  const { prefs } = usePrefs();
  const mapEl = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const satFrames = useRef<FrameStack | null>(null);
  const radarFrames = useRef<FrameStack | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const tcMarkers = useRef<maplibregl.Marker[]>([]);
  const rafRef = useRef(0);
  const gridKey = useRef("");
  const adminKey = useRef("");

  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<LayerId>("wind");
  const [globe, setGlobe] = useState(false);
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
  const [sunTick, setSunTick] = useState(0);

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
      if (localStorage.getItem(GLOBE_KEY) === "1") setGlobe(true);
    } catch {
      /* storage blocked */
    }

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: baseStyle(),
      center: hasQuery ? [qlon, qlat] : INDIA,
      zoom: hasQuery ? 7 : 3.6,
      minZoom: 1.2,
      maxZoom: 14,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      setReady(true);
      setViewTick((t) => t + 1); // load the data for the first view without waiting for a move
    });
    // A missing font or tile should never break the map
    map.on("error", (e) => console.warn("[map]", e?.error?.message ?? e));

    // Single click opens a place; a double click is left to zoom the map.
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    map.on("click", (e: MapMouseEvent) => {
      clearTimeout(clickTimer);
      if (map.getLayer("tc-pts") && map.queryRenderedFeatures(e.point, { layers: ["tc-pts"] }).length) return;
      const p = e.lngLat.wrap();
      clickTimer = setTimeout(() => setSelected({ lat: p.lat, lon: p.lng }), 230);
    });
    map.on("dblclick", () => clearTimeout(clickTimer));

    let tick = 0;
    map.on("moveend", () => {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => setViewTick((t) => t + 1));
    });

    if (hasQuery) setSelected({ lat: qlat, lon: qlon, name: params.get("name") ?? undefined });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAYER_KEY, layer);
      localStorage.setItem(GLOBE_KEY, globe ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [layer, globe]);

  /* ─── Globe / flat ────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setProjection({ type: globe ? "globe" : "mercator" });
    } catch (e) {
      console.warn("[map] projection", e);
    }
  }, [globe, ready]);

  /* ─── Selected point marker ───────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!selected) return;
    const el = document.createElement("div");
    el.className = "pin-pulse";
    markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([selected.lon, selected.lat]).addTo(map);
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
    if (!map || !ready) return;
    satFrames.current?.clear();
    satFrames.current = null;
    if (layer !== "satellite" || !sat || !sat.frames.length) return;
    const ir = sat.id !== "truecolor";
    satFrames.current = new FrameStack(map, "sat", SLOT_SAT, sat.frames.length, sat.maxNativeZoom, ir ? 0.9 : sat.opacity, (i) => satTileUrl(sat, i), ir ? 0.25 : 0);
    const last = sat.frames.length - 1;
    setSatIdx(last);
    satFrames.current.show(last);
    const t = sat.frames.length > 1 ? setTimeout(() => setPlaying(true), 2500) : undefined;
    return () => clearTimeout(t);
  }, [layer, sat, ready]);

  useEffect(() => {
    satFrames.current?.show(satIdx);
  }, [satIdx, sat]);

  // Infrared clouds sit on the night-lights base (city lights show through gaps); no extra night shading there.
  const irMode = layer === "satellite" && !!sat && sat.id !== "truecolor";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("night", "visibility", irMode ? "visible" : "none");
    map.setLayoutProperty("shade", "visibility", irMode ? "none" : "visible");
  }, [irMode, ready]);

  /* ─── Day / night shading (GPU image, follows the map perfectly) ─── */
  useEffect(() => {
    const t = setInterval(() => setSunTick((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const sun = subsolarPoint(new Date());
    const rad = Math.PI / 180;
    const sinD = Math.sin(sun.lat * rad);
    const cosD = Math.cos(sun.lat * rad);
    const url = mercatorImage(720, 512, [-180, -MERC_MAX, 180, MERC_MAX], (lat, lon) => {
      const elev = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat * rad) * sinD + Math.cos(lat * rad) * cosD * Math.cos((lon - sun.lon) * rad)))) / rad;
      // full daylight above +2°, deepening through civil/nautical twilight, full night below −12°
      const t = Math.max(0, Math.min(1, (2 - elev) / 14));
      return [3, 7, 20, 255 * 0.62 * t * t * (3 - 2 * t)];
    });
    (map.getSource("shade") as ImageSource | undefined)?.updateImage({ url, coordinates: WORLD });
  }, [sunTick, ready]);

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
    const map = mapRef.current;
    if (!map || !ready) return;
    tcMarkers.current.forEach((m) => m.remove());
    tcMarkers.current = [];
    const ctrl = new AbortController();
    const cone: GeoJSON.Feature[] = [];
    const track: GeoJSON.Feature[] = [];
    const points: GeoJSON.Feature[] = [];
    const flush = () => {
      (map.getSource("tcCone") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: cone });
      (map.getSource("tcTrack") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: track });
      (map.getSource("tcPts") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: points });
    };
    flush();

    for (const c of cyclones) {
      const fallback = c.alertLevel === "Red" ? IMD_CLASSES[5] : c.alertLevel === "Orange" ? IMD_CLASSES[3] : IMD_CLASSES[2];
      const el = document.createElement("div");
      el.innerHTML = cycloneIcon(c.name, fallback);
      const popup = new maplibregl.Popup({ offset: 18, className: "tc-popup", maxWidth: "260px" }).setHTML(cyclonePopup(c, fallback));
      const marker = new maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).setPopup(popup).addTo(map);
      tcMarkers.current.push(marker);

      fetch(`/api/cyclones/track?id=${encodeURIComponent(c.id)}${c.episodeId ? `&episode=${encodeURIComponent(c.episodeId)}` : ""}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { features: TrackFeature[] }) => {
          const feats = d.features ?? [];
          const pts = feats
            .filter((x) => x.kind === "point" && x.geometry.type === "Point")
            .map((x) => {
              const [plon, plat] = (x.geometry as GeoJSON.Point).coordinates;
              const forecast = x.level === "cone" || /forecast/i.test(x.label ?? "");
              return { lat: plat, lon: plon, time: x.time, wind: x.windKmh, forecast, cls: imdClass(x.windKmh) };
            })
            .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

          // 1. Forecast cone: smooth rounded envelope that widens with uncertainty
          const future = pts.filter((p) => p.forecast);
          if (future.length) {
            cone.push({ type: "Feature", properties: {}, geometry: smoothCone([{ lat: c.lat, lon: c.lon, r: 35 }, ...future.map((p, i) => ({ lat: p.lat, lon: p.lon, r: 60 + 45 * i }))]) });
          } else {
            for (const x of feats) if (x.kind === "area" && x.level === "cone") cone.push({ type: "Feature", properties: {}, geometry: x.geometry });
          }

          // 2. Track segments coloured by intensity (forecast part lighter)
          if (pts.length > 1) {
            for (let i = 0; i < pts.length - 1; i++) {
              const a = pts[i];
              const b = pts[i + 1];
              track.push({
                type: "Feature",
                properties: { color: (b.forecast ? b.cls : a.cls)?.color ?? "#ffffff", opacity: b.forecast ? 0.7 : 1 },
                geometry: { type: "LineString", coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
              });
            }
          } else {
            for (const x of feats) {
              if (x.kind === "past" || x.kind === "forecast") track.push({ type: "Feature", properties: { color: "#ffffff", opacity: x.kind === "past" ? 0.9 : 0.5 }, geometry: x.geometry });
            }
          }

          // 3. Points with date & time labels
          const step = pts.length > 10 ? 2 : 1;
          pts.forEach((p, i) => {
            const color = p.cls?.color ?? "#ffffff";
            const isNow = !p.forecast && (i === pts.length - 1 || pts[i + 1].forecast);
            const props: Record<string, unknown> = {
              color,
              forecast: p.forecast,
              popup: `<div class="tc-pop"><div class="tc-pop-name">${escapeHtml(c.name)}${p.forecast ? " · forecast" : ""}</div>${p.time ? `<div>${escapeHtml(fmtTrackTime(p.time, true))}</div>` : ""}${p.wind != null ? `<div style="color:${color};font-weight:600">${p.wind} km/h · ${escapeHtml(p.cls?.name ?? "")}</div>` : ""}</div>`,
            };
            if (p.time && !isNow && (i % step === 0 || i === pts.length - 1)) props.label = fmtTrackTime(p.time);
            points.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
          });
          flush();

          const past = pts.filter((p) => !p.forecast && p.wind != null);
          const wind = past.length ? (past[past.length - 1].wind as number) : undefined;
          const now = imdClass(wind) ?? fallback;
          el.innerHTML = cycloneIcon(c.name, now);
          popup.setHTML(cyclonePopup(c, now, wind));
        })
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [cyclones, ready]);

  // Popups for track points + pointer cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onClick = (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      new maplibregl.Popup({ offset: 10, className: "tc-popup", maxWidth: "260px" })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(String(f.properties?.popup ?? ""))
        .addTo(map);
    };
    const enter = () => (map.getCanvas().style.cursor = "pointer");
    const leave = () => (map.getCanvas().style.cursor = "");
    map.on("click", "tc-pts", onClick);
    map.on("mouseenter", "tc-pts", enter);
    map.on("mouseleave", "tc-pts", leave);
    return () => {
      map.off("click", "tc-pts", onClick);
      map.off("mouseenter", "tc-pts", enter);
      map.off("mouseleave", "tc-pts", leave);
    };
  }, [ready]);

  /* ─── District & taluk boundaries with names (zoom 6+ / 8+) ─── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const z = map.getZoom();
    const levels: (2 | 3)[] = z >= 8 ? [2, 3] : z >= 6 ? [2] : [];
    const b = map.getBounds();
    const padX = (b.getEast() - b.getWest()) * 0.15;
    const padY = (b.getNorth() - b.getSouth()) * 0.15;
    const box = [b.getWest() - padX, b.getSouth() - padY, b.getEast() + padX, b.getNorth() + padY].map((v) => v.toFixed(1));
    const key = `${levels.join(",")}|${box.join(",")}`;
    if (key === adminKey.current) return;
    adminKey.current = key;
    const setAdm = (lines: GeoJSON.Feature[], labels: GeoJSON.Feature[]) => {
      (map.getSource("adm") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: lines });
      (map.getSource("admLabels") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: labels });
    };
    if (!levels.length) {
      setAdm([], []);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const results: FC[] = await Promise.all(
          levels.map((lvl) => fetch(`/api/boundaries?level=${lvl}&w=${box[0]}&s=${box[1]}&e=${box[2]}&n=${box[3]}`, { signal: ctrl.signal }).then((r) => r.json())),
        );
        const lines: GeoJSON.Feature[] = [];
        const labels: GeoJSON.Feature[] = [];
        results.forEach((fc, i) => {
          for (const f of fc.features ?? []) {
            const props = f.properties as { name?: string; label?: [number, number] } | null;
            lines.push({ type: "Feature", properties: { level: levels[i] }, geometry: f.geometry });
            if (props?.name && props.label) labels.push({ type: "Feature", properties: { level: levels[i], name: props.name }, geometry: { type: "Point", coordinates: props.label } });
          }
        });
        setAdm(lines, labels);
      } catch {
        /* aborted or unavailable */
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [viewTick, ready]);

  /* ─── Forecast grid for the visible area ──────────────── */
  const timeIdxRef = useRef(0);
  timeIdxRef.current = timeIdx;
  const gridRef = useRef<GridData | null>(null);

  const loadGrid = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const w = Math.max(-180, b.getWest());
    const e = Math.min(180, b.getEast());
    const s = Math.max(-80, b.getSouth());
    const n = Math.min(80, b.getNorth());
    if (e <= w || n <= s) return;
    setGridLoading(true);
    try {
      const res = await fetch(`/api/grid?w=${w.toFixed(2)}&s=${s.toFixed(2)}&e=${e.toFixed(2)}&n=${n.toFixed(2)}`);
      if (!res.ok) return;
      const g: GridData = await res.json();
      const key = g.bbox.join(",") + g.cols + "x" + g.rows;
      if (key === gridKey.current) return;
      gridKey.current = key;
      const prevTime = gridRef.current?.times[timeIdxRef.current];
      const idx = prevTime ? g.times.indexOf(prevTime) : -1;
      gridRef.current = g;
      setGrid(g);
      setTimeIdx(idx >= 0 ? idx : nowIndex(g.times));
    } catch {
      /* keep the old grid */
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!def.gridVar || !ready) return;
    const t = setTimeout(loadGrid, 500);
    return () => clearTimeout(t);
  }, [viewTick, def.gridVar, loadGrid, ready]);

  /* ─── Weather field (GPU image) + numbers ─────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const heat = map.getSource("heat") as ImageSource | undefined;
    const valuesSrc = map.getSource("values") as GeoJSONSource | undefined;
    const hide = () => {
      map.setLayoutProperty("heat", "visibility", "none");
      valuesSrc?.setData({ type: "FeatureCollection", features: [] });
    };
    if (!grid || !def.gridVar || !def.stops) return hide();
    const values = grid.values[def.gridVar][Math.min(timeIdx, grid.times.length - 1)];
    if (!values) return hide();

    const scale = makeScale(def.stops);
    const [w, s, e, n] = grid.bbox;
    const url = mercatorImage(256, 256, [w, s, e, n], (lat, lon) => {
      const v = sample(grid, values, lat, lon);
      return Number.isNaN(v) ? null : scale(v);
    });
    heat?.updateImage({
      url,
      coordinates: [
        [w, Math.min(n, MERC_MAX)],
        [e, Math.min(n, MERC_MAX)],
        [e, Math.max(s, -MERC_MAX)],
        [w, Math.max(s, -MERC_MAX)],
      ],
    });
    map.setPaintProperty("heat", "raster-opacity", def.opacity);
    map.setLayoutProperty("heat", "visibility", "visible");

    const feats: GeoJSON.Feature[] = [];
    if (def.labels) {
      const dx = (e - w) / (grid.cols - 1);
      const dy = (n - s) / (grid.rows - 1);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const v = values[r * grid.cols + c];
          if (v == null || Number.isNaN(v)) continue;
          const text = layer === "temp" ? fmtTemp(v, prefs.tempUnit) : layer === "wind" ? fmtWind(v, prefs.windUnit).split(" ")[0] : String(Math.round(v));
          feats.push({ type: "Feature", properties: { text }, geometry: { type: "Point", coordinates: [w + c * dx, n - r * dy] } });
        }
      }
    }
    valuesSrc?.setData({ type: "FeatureCollection", features: feats });
  }, [grid, timeIdx, layer, def, prefs.tempUnit, prefs.windUnit, ready]);

  /* ─── Animated wind particles (overlay canvas) ────────── */
  useEffect(() => {
    const map = mapRef.current;
    const canvas = flowRef.current;
    cancelAnimationFrame(rafRef.current);
    if (!map || !canvas || !ready) return;
    const { clientWidth: W, clientHeight: H } = map.getContainer();
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    if (layer !== "wind" || !grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { u, v } = windComponents(grid, Math.min(timeIdx, grid.times.length - 1));
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || W < 700;
    const count = Math.round(Math.min(1800, (W * H) / 800) * (lowEnd ? 0.6 : 1));
    // On the globe, only screen points that actually lie on the Earth's surface are valid
    // (a point in space doesn't survive the screen → map → screen round trip).
    const onSurface = (x: number, y: number) => {
      if (!globe) return true;
      const back = map.project(map.unproject([x, y]));
      return Math.abs(back.x - x) < 1.5 && Math.abs(back.y - y) < 1.5;
    };
    const spawn = () => {
      let x = Math.random() * W;
      let y = Math.random() * H;
      for (let tries = 0; tries < 6 && !onSurface(x, y); tries++) {
        x = Math.random() * W;
        y = Math.random() * H;
      }
      return { x, y, age: onSurface(x, y) ? Math.floor(Math.random() * 80) : 999, max: 60 + Math.random() * 60 };
    };
    let tickN = 0;
    const particles = Array.from({ length: count }, spawn);
    const k = 0.05;
    let odd = false;
    let running = true;

    const frame = () => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(frame);
      if (lowEnd && (odd = !odd)) return;
      tickN++;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (globe && (i + tickN) % 6 === 0 && !onSurface(p.x, p.y)) {
          particles[i] = { ...spawn(), age: 0 };
          continue;
        }
        const ll = map.unproject([p.x, p.y]);
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
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) particles[i] = { ...spawn(), age: 0 };
      }
      ctx.stroke();
    };
    // Particles live in screen space: clear them while the map moves, restart when it settles.
    const pause = () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, W, H);
    };
    map.on("movestart", pause);
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      pause();
      map.off("movestart", pause);
    };
  }, [grid, timeIdx, layer, viewTick, ready, globe]);

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
    if (!map || !ready) return;
    radarFrames.current?.clear();
    radarFrames.current = null;
    if (layer !== "radar" || !radar.length) return;
    radarFrames.current = new FrameStack(map, "radar", SLOT_RADAR, radar.length, 7, 0.85, (i) => radar[i].url);
    radarFrames.current.show(radar.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, radar, ready]);

  useEffect(() => {
    radarFrames.current?.show(radarIdx);
  }, [radarIdx, radar]);

  /* ─── Playback ────────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      // Only advance when the next frame has downloaded, so slow connections don't pile up requests.
      if (layer === "radar")
        setRadarIdx((i) => (radar.length && radarFrames.current?.ready((i + 1) % radar.length) !== false ? (i + 1) % radar.length : i));
      else if (layer === "satellite")
        setSatIdx((i) => {
          const n = sat?.frames.length ?? 0;
          return n && satFrames.current?.ready((i + 1) % n) !== false ? (i + 1) % n : i;
        });
      else if (grid) setTimeIdx((i) => (i + 1) % grid.times.length);
    }, layer === "radar" || layer === "satellite" ? 700 : 1000);
    return () => clearInterval(t);
  }, [playing, layer, grid, radar.length, sat]);

  /* ─── Actions ─────────────────────────────────────────── */
  const flyTo = (p: PickedPlace) => {
    mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 8, duration: 1400, essential: true });
    setSelected({ lat: p.lat, lon: p.lon, name: p.name, region: p.region, country: p.country });
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => flyTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "" }),
      () => toast("Location access is blocked. Allow it in your browser to see your local weather.", "error"),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const timeline = useMemo(() => {
    if (layer === "radar") {
      return { count: radar.length, idx: radarIdx, set: setRadarIdx, label: radar[radarIdx] ? fmtTime(radar[radarIdx].time * 1000) : "Loading radar…", note: "Past 2 hours" };
    }
    if (layer === "satellite") {
      if (!sat) return { count: 0, idx: 0, set: setSatIdx, label: "Loading live satellite…", note: "" };
      const t = sat.frames[Math.min(satIdx, sat.frames.length - 1)];
      const ms = t && t.length > 10 ? Date.parse(t) : NaN;
      return { count: sat.frames.length, idx: Math.min(satIdx, sat.frames.length - 1), set: setSatIdx, label: Number.isFinite(ms) ? fmtTime(ms) : sat.label, note: sat.note };
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
      <div ref={mapEl} style={{ position: "absolute", inset: 0 }} aria-label="Interactive weather map" role="application" />
      <canvas ref={flowRef} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" aria-hidden="true" />

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
        className="glass absolute bottom-[132px] left-3 right-3 z-[1000] flex gap-1 overflow-x-auto rounded-2xl p-1.5 scrollbar-thin sm:bottom-auto sm:left-auto sm:right-3 sm:top-[76px] sm:w-[132px] sm:flex-col"
      >
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setLayer(l.id);
              setPlaying(false);
            }}
            aria-pressed={layer === l.id}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
              layer === l.id ? "bg-white text-black" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon name={l.icon} size={15} />
            <span>{l.label}</span>
          </button>
        ))}
        <div className="mx-1 my-1 hidden h-px bg-white/10 sm:block" />
        <button
          onClick={() => setGlobe((g) => !g)}
          aria-pressed={globe}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
            globe ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Switch between a 3D globe and a flat map"
        >
          <GlobeIcon />
          <span>{globe ? "Globe" : "Flat map"}</span>
        </button>
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
              <span className="shrink-0 text-xs text-white/60">{gridLoading && def.gridVar ? "Updating…" : timeline.note}</span>
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
      {selected && <PointPanel point={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────── */

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

function satTileUrl(sat: SatSource, i: number) {
  const time = sat.frames[Math.min(i, sat.frames.length - 1)] || new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  if (sat.kind === "xyz") return sat.url.replace("{time}", encodeURIComponent(time));
  // EUMETSAT tiles come through our server (they need CORS headers for WebGL); MapLibre fills in the bbox
  const q = new URLSearchParams({ layer: sat.layer ?? "", time });
  return `${window.location.origin}/api/sat-tile?${q}&bbox={bbox-epsg-3857}`;
}

/**
 * Animation frames for satellite / radar. Each frame is its own raster layer; only the current and the next
 * frame are created, so the browser downloads one frame at a time instead of every frame at once.
 */
class FrameStack {
  private made = new Set<number>();
  constructor(
    private map: MLMap,
    private prefix: string,
    private before: string,
    private count: number,
    private maxzoom: number,
    private opacity: number,
    private url: (i: number) => string,
    private contrast = 0,
  ) {}
  private id(i: number) {
    return `${this.prefix}-${i}`;
  }
  private ensure(i: number) {
    if (this.made.has(i)) return;
    try {
      this.map.addSource(this.id(i), { type: "raster", tiles: [this.url(i)], tileSize: 256, maxzoom: this.maxzoom });
      this.map.addLayer(
        { id: this.id(i), type: "raster", source: this.id(i), paint: { "raster-opacity": 0, "raster-fade-duration": 0, "raster-contrast": this.contrast } },
        this.before,
      );
      this.made.add(i);
    } catch (e) {
      console.warn("[map] frame layer failed", e); // one broken frame must never take the whole map down
    }
  }
  show(iIn: number) {
    if (this.count <= 0) return;
    const i = ((iIn % this.count) + this.count) % this.count;
    this.ensure(i);
    if (this.count > 1) this.ensure((i + 1) % this.count);
    for (const k of this.made) {
      if (this.map.getLayer(this.id(k))) this.map.setPaintProperty(this.id(k), "raster-opacity", k === i ? this.opacity : 0);
    }
  }
  /** true when frame i has finished downloading the visible tiles (or doesn't exist yet). */
  ready(i: number) {
    if (!this.made.has(i)) return true;
    try {
      return this.map.isSourceLoaded(this.id(i));
    } catch {
      return true;
    }
  }
  clear() {
    for (const k of this.made) {
      try {
        if (this.map.getLayer(this.id(k))) this.map.removeLayer(this.id(k));
        if (this.map.getSource(this.id(k))) this.map.removeSource(this.id(k));
      } catch {
        /* map already gone */
      }
    }
    this.made.clear();
  }
}

/**
 * Renders a lat/lon field into a PNG whose rows are spaced in Web-Mercator, so MapLibre can stretch it over
 * the bounding box exactly. The GPU smooths it (linear resampling) — no per-frame CPU work while panning.
 */
function mercatorImage(
  w: number,
  h: number,
  [west, south, east, north]: [number, number, number, number],
  fn: (lat: number, lon: number) => readonly [number, number, number, number] | number[] | null,
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const rad = Math.PI / 180;
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-MERC_MAX, Math.min(MERC_MAX, lat)) * rad) / 2));
  const yN = merc(north);
  const yS = merc(south);
  for (let y = 0; y < h; y++) {
    const my = yN + ((y + 0.5) / h) * (yS - yN);
    const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) / rad;
    for (let x = 0; x < w; x++) {
      const lon = west + ((x + 0.5) / w) * (east - west);
      const c = fn(lat, lon);
      if (!c) continue;
      const i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = c[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/* IMD intensity classes for North Indian Ocean cyclones (maximum sustained wind, km/h). */
type ImdClass = { min: number; name: string; short: string; color: string };
const IMD_CLASSES: ImdClass[] = [
  { min: 31, name: "Depression", short: "D", color: "#6fc3ff" },
  { min: 50, name: "Deep Depression", short: "DD", color: "#4fd1a5" },
  { min: 62, name: "Cyclonic Storm", short: "CS", color: "#f2d24b" },
  { min: 89, name: "Severe Cyclonic Storm", short: "SCS", color: "#f7a541" },
  { min: 118, name: "Very Severe Cyclonic Storm", short: "VSCS", color: "#f26b3a" },
  { min: 166, name: "Extremely Severe Cyclonic Storm", short: "ESCS", color: "#e3365f" },
  { min: 222, name: "Super Cyclonic Storm", short: "SuCS", color: "#b43ad6" },
];

function imdClass(windKmh?: number | null): ImdClass | null {
  if (windKmh == null || !Number.isFinite(windKmh)) return null;
  let cls: ImdClass | null = null;
  for (const c of IMD_CLASSES) if (windKmh >= c.min) cls = c;
  return cls ?? { min: 0, name: "Low pressure area", short: "L", color: "#a9b4c6" };
}

/** Point on Earth where the sun is directly overhead (low-precision solar ephemeris, good to ~0.1°). */
function subsolarPoint(date: Date) {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const rad = Math.PI / 180;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)) / rad;
  const gmst = 280.46061837 + 360.98564736629 * d;
  const lon = ((((ra - gmst + 180) % 360) + 360) % 360) - 180;
  return { lat: dec, lon };
}

/** Rounded forecast cone: convex hull of circles (radius in km) around each forecast position. */
function smoothCone(points: { lat: number; lon: number; r: number }[]): GeoJSON.Polygon {
  const samples: [number, number][] = [];
  for (const p of points) {
    const kLat = p.r / 111;
    const kLon = p.r / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    for (let a = 0; a < 32; a++) {
      const t = (a / 32) * 2 * Math.PI;
      samples.push([p.lon + kLon * Math.cos(t), p.lat + kLat * Math.sin(t)]);
    }
  }
  const pts = samples.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return { type: "Polygon", coordinates: [[...hull, hull[0]]] };
}

/** GDACS times are UTC; show them in the viewer's local time, e.g. "Fri 30 Oct, 5:30 pm". */
function fmtTrackTime(t: string, long = false) {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t.replace("T", " ").slice(5, 16);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-IN", o);
  const hm = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return long
    ? `${part({ weekday: "long" })}, ${part({ day: "numeric" })} ${part({ month: "short" })} · ${hm}`
    : `${part({ weekday: "short" })} ${part({ day: "numeric" })} ${part({ month: "short" })}, ${hm}`;
}

function cycloneIcon(name: string, cls: ImdClass) {
  return `<div class="tc-marker" style="--c:${cls.color}"><svg viewBox="0 0 32 32" width="34" height="34"><path d="M16 9.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 3.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" fill="var(--c)" stroke="#fff" stroke-width="1.2"/><path d="M16 9.5C16 5 19.5 2.2 24 2.4c-3 1.4-4.6 3.8-4.6 7.6M16 22.5c0 4.5-3.5 7.3-8 7.1 3-1.4 4.6-3.8 4.6-7.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M16 9.5C16 5 19.5 2.2 24 2.4c-3 1.4-4.6 3.8-4.6 7.6M16 22.5c0 4.5-3.5 7.3-8 7.1 3-1.4 4.6-3.8 4.6-7.6" fill="none" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/></svg><span class="tc-tag">${escapeHtml(name.toUpperCase())}<em>${cls.short}</em></span></div>`;
}

function cyclonePopup(c: { name: string; alertLevel: string; severity: string; link: string }, cls: ImdClass, wind?: number) {
  return `<div class="tc-pop"><div class="tc-pop-name">Cyclone ${escapeHtml(c.name)}</div><div style="color:${cls.color};font-weight:600">${escapeHtml(cls.name)}${wind != null ? ` · ${wind} km/h` : ""}</div><div>GDACS ${escapeHtml(c.alertLevel)} alert${c.severity ? ` · ${escapeHtml(c.severity)}` : ""}</div><a href="${c.link}" target="_blank" rel="noopener noreferrer">Track & impact report ↗</a></div>`;
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
  return new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
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
