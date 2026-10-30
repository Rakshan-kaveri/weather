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

type Cyclone = { id: string; episodeId: string | null; name: string; alertLevel: "Green" | "Orange" | "Red"; lat: number; lon: number; severity: string; link: string };

export default function MapExplorer() {
  const { prefs } = usePrefs();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const flowRef = useRef<HTMLCanvasElement | null>(null);
  const satStack = useRef<FrameStack | null>(null);
  const cycloneLayer = useRef<L.LayerGroup | null>(null);
  const trackLayer = useRef<L.LayerGroup | null>(null);
  const adminLayer = useRef<L.LayerGroup | null>(null);
  const nightLayer = useRef<L.TileLayer | null>(null);
  const shadeRef = useRef<HTMLCanvasElement | null>(null);
  const [sunTick, setSunTick] = useState(0);
  const adminKey = useRef("");
  const radarStack = useRef<FrameStack | null>(null);
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
      preferCanvas: true, // boundaries & tracks drawn on one canvas instead of hundreds of SVG nodes
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 110,
      wheelDebounceTime: 30,
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
    map.createPane("night").style.zIndex = "240";
    nightLayer.current = L.tileLayer(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
      { pane: "night", maxNativeZoom: 8, maxZoom: 15, attribution: "Night lights: NASA Black Marble" },
    );
    // Day/night shading from the real sun position, between the base imagery and the clouds
    const shadePane = map.createPane("shade");
    shadePane.style.zIndex = "245";
    shadePane.style.pointerEvents = "none";
    shadeRef.current = L.DomUtil.create("canvas", "", shadePane) as HTMLCanvasElement;
    map.createPane("sat").style.zIndex = "250";
    map.createPane("tracks").style.zIndex = "610";
    trackLayer.current = L.layerGroup([], { pane: "tracks" }).addTo(map);
    map.createPane("cyclones").style.zIndex = "620";
    cycloneLayer.current = L.layerGroup([], { pane: "cyclones" }).addTo(map);
    const adminPane = map.createPane("admin");
    adminPane.style.zIndex = "455";
    adminPane.style.pointerEvents = "none";
    adminLayer.current = L.layerGroup([], { pane: "admin" }).addTo(map);
    map.attributionControl.addAttribution("Boundaries: geoBoundaries (CC BY 4.0) · Cyclones: GDACS");

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

    // Single click opens a place; a double click is left to zoom the map (otherwise both fire and race).
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    map.on("click", (e: L.LeafletMouseEvent) => {
      clearTimeout(clickTimer);
      const p = e.latlng.wrap();
      clickTimer = setTimeout(() => setSelected({ lat: p.lat, lon: p.lng }), 230);
    });
    map.on("dblclick", () => clearTimeout(clickTimer));
    map.on("zoomstart", () => {
      if (heatRef.current) heatRef.current.style.visibility = "hidden";
      if (flowRef.current) flowRef.current.style.visibility = "hidden";
      if (shadeRef.current) shadeRef.current.style.visibility = "hidden";
    });
    // Blend modes and CSS filters are costly to repaint every animation frame, so pause them during pan/zoom.
    const sat = map.getPane("sat")!;
    map.on("movestart zoomstart", () => {
      sat.dataset.blend = sat.style.mixBlendMode;
      sat.dataset.filter = sat.style.filter;
      sat.style.mixBlendMode = "";
      sat.style.filter = "";
    });
    map.on("moveend zoomend", () => {
      if (sat.dataset.blend !== undefined) sat.style.mixBlendMode = sat.dataset.blend;
      if (sat.dataset.filter !== undefined) sat.style.filter = sat.dataset.filter;
    });
    let tick = 0;
    map.on("moveend zoomend resize", () => {
      // coalesce bursts of events (zoom fires both) into one re-render on the next frame
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
    satStack.current?.clear();
    satStack.current = null;
    if (layer !== "satellite" || !sat) return;
    satStack.current = new FrameStack(
      map,
      (i) => {
        const time = sat.frames[i];
        return sat.kind === "wms"
          ? L.tileLayer.wms(sat.url, {
              pane: "sat",
              layers: sat.layer!,
              format: "image/png",
              transparent: true,
              version: "1.3.0",
              maxNativeZoom: sat.maxNativeZoom,
              maxZoom: 15,
              updateWhenZooming: false,
              attribution: sat.attribution,
              ...(time ? { time } : {}),
            } as L.WMSOptions)
          : L.tileLayer(sat.url, {
              pane: "sat",
              maxNativeZoom: sat.maxNativeZoom,
              maxZoom: 15,
              updateWhenZooming: false,
              attribution: sat.attribution,
              time,
            } as L.TileLayerOptions);
      },
      sat.opacity,
    );
    const last = sat.frames.length - 1;
    setSatIdx(last);
    satStack.current.show(last, sat.frames.length);
    // Start the loop once the latest frame has had a moment to load.
    const t = sat.frames.length > 1 ? setTimeout(() => setPlaying(true), 2500) : undefined;
    return () => clearTimeout(t);
  }, [layer, sat]);

  useEffect(() => {
    if (sat) satStack.current?.show(satIdx, sat.frames.length);
  }, [satIdx, sat]);

  /* Infrared clouds look best over a dark night-lights base: the "screen" blend makes cold bright cloud tops
     glow while the warm (dark) ground disappears, so city lights and coastlines show through. */
  useEffect(() => {
    const map = mapRef.current;
    const pane = map?.getPane("sat");
    if (!map || !pane) return;
    const ir = layer === "satellite" && !!sat && sat.id !== "truecolor";
    if (ir) nightLayer.current?.addTo(map);
    else nightLayer.current?.remove();
    pane.style.mixBlendMode = ir ? "screen" : "";
    pane.style.filter = ir ? "contrast(1.45) brightness(1.08)" : "";
  }, [layer, sat]);

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
    const tracks = trackLayer.current;
    if (!group || !tracks) return;
    group.clearLayers();
    tracks.clearLayers();
    const ctrl = new AbortController();
    type TF = { kind: "past" | "forecast" | "point" | "area"; level?: string; label?: string; windKmh?: number; time?: string; geometry: GeoJSON.Geometry };

    for (const c of cyclones) {
      // Current position: the standard tropical-cyclone symbol, coloured by IMD intensity class once the track is known.
      const fallback = c.alertLevel === "Red" ? IMD_CLASSES[5] : c.alertLevel === "Orange" ? IMD_CLASSES[3] : IMD_CLASSES[2];
      const marker = L.marker([c.lat, c.lon], { icon: cycloneIcon(c.name, fallback), pane: "cyclones", title: c.name, riseOnHover: true })
        .bindPopup(cyclonePopup(c, fallback, undefined))
        .addTo(group);

      fetch(`/api/cyclones/track?id=${encodeURIComponent(c.id)}${c.episodeId ? `&episode=${encodeURIComponent(c.episodeId)}` : ""}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { features: TF[] }) => {
          const feats = d.features ?? [];
          // Ordered track points (past → forecast)
          const pts = feats
            .filter((x) => x.kind === "point" && x.geometry.type === "Point")
            .map((x) => {
              const [plon, plat] = (x.geometry as GeoJSON.Point).coordinates;
              const forecast = x.level === "cone" || /forecast/i.test(x.label ?? "");
              return { lat: plat, lon: plon, time: x.time, wind: x.windKmh, forecast, cls: imdClass(x.windKmh) };
            })
            .sort((p1, p2) => (p1.time ?? "").localeCompare(p2.time ?? ""));

          // 1. Forecast cone: a smooth, rounded envelope that widens with forecast uncertainty
          const future = pts.filter((p) => p.forecast);
          const conePolys = future.length
            ? [smoothCone([{ lat: c.lat, lon: c.lon, r: 35 }, ...future.map((p, i) => ({ lat: p.lat, lon: p.lon, r: 60 + 45 * i }))])]
            : feats.filter((x) => x.kind === "area" && x.level === "cone").map((x) => x.geometry);
          for (const g of conePolys) {
            L.geoJSON({ type: "Feature", properties: {}, geometry: g } as GeoJSON.Feature, {
              pane: "tracks",
              interactive: false,
              style: { stroke: true, color: "#ffffff", weight: 1, opacity: 0.18, fillColor: "#d9dee8", fillOpacity: 0.2, lineJoin: "round" },
            }).addTo(tracks);
          }

          // 2. Track: dark casing + segments coloured by intensity (forecast part lighter)
          if (pts.length > 1) {
            L.polyline(pts.map((p) => [p.lat, p.lon] as L.LatLngTuple), { pane: "tracks", color: "#000", weight: 5, opacity: 0.35, interactive: false, lineCap: "round", lineJoin: "round" }).addTo(tracks);
            for (let i = 0; i < pts.length - 1; i++) {
              const p = pts[i];
              L.polyline(
                [
                  [p.lat, p.lon],
                  [pts[i + 1].lat, pts[i + 1].lon],
                ],
                { pane: "tracks", color: (pts[i + 1].forecast ? pts[i + 1].cls : p.cls)?.color ?? "#ffffff", weight: 2.6, opacity: pts[i + 1].forecast ? 0.7 : 1, interactive: false, lineCap: "round" },
              ).addTo(tracks);
            }
          } else {
            // no point list: fall back to GDACS lines
            for (const f of feats.filter((x) => x.kind === "past" || x.kind === "forecast")) {
              L.geoJSON({ type: "Feature", properties: {}, geometry: f.geometry } as GeoJSON.Feature, {
                pane: "tracks",
                interactive: false,
                style: { color: "#ffffff", weight: 2, opacity: f.kind === "past" ? 0.9 : 0.5 },
              }).addTo(tracks);
            }
          }

          // 3. Points with date & time labels (local time)
          const past = pts.filter((p) => !p.forecast && p.wind != null);
          const latest = past.length ? { wind: past[past.length - 1].wind as number } : null;
          const step = pts.length > 10 ? 2 : 1;
          pts.forEach((p, i) => {
            const color = p.cls?.color ?? "#ffffff";
            const m = L.circleMarker([p.lat, p.lon], {
              pane: "tracks",
              radius: 5,
              weight: p.forecast ? 2 : 1.5,
              color: p.forecast ? color : "rgba(0,0,0,0.6)",
              fillColor: p.forecast ? "#ffffff" : color,
              fillOpacity: 1,
            })
              .bindPopup(
                `<div class="tc-pop"><div class="tc-pop-name">${escapeHtml(c.name)}${p.forecast ? " · forecast" : ""}</div>${p.time ? `<div>${escapeHtml(fmtTrackTime(p.time, true))}</div>` : ""}${p.wind != null ? `<div style="color:${color};font-weight:600">${p.wind} km/h · ${escapeHtml(p.cls?.name ?? "")}</div>` : ""}</div>`,
              )
              .addTo(tracks);
            const isNow = !p.forecast && (i === pts.length - 1 || pts[i + 1].forecast);
            if (p.time && !isNow && (i % step === 0 || i === pts.length - 1)) {
              m.bindTooltip(fmtTrackTime(p.time), { permanent: true, direction: "right", offset: [7, 0], className: `tc-time${p.forecast ? " tc-time-fc" : ""}` });
            }
          });
          const now = imdClass(latest?.wind) ?? fallback;
          marker.setIcon(cycloneIcon(c.name, now));
          marker.setPopupContent(cyclonePopup(c, now, latest?.wind));
        })
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [cyclones]);

  /* ─── District & taluk boundaries with names (zoom 7+ / 9+) ─── */
  useEffect(() => {
    const map = mapRef.current;
    const group = adminLayer.current;
    if (!map || !group) return;
    const z = map.getZoom();
    const levels: (2 | 3)[] = z >= 9 ? [2, 3] : z >= 7 ? [2] : [];
    const b = map.getBounds().pad(0.15);
    const box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(1));
    const key = `${levels.join(",")}|${box.join(",")}`;
    if (key === adminKey.current) return;
    adminKey.current = key;
    if (!levels.length) {
      group.clearLayers();
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const results = await Promise.all(
          levels.map((lvl) =>
            fetch(`/api/boundaries?level=${lvl}&w=${box[0]}&s=${box[1]}&e=${box[2]}&n=${box[3]}`, { signal: ctrl.signal }).then((r) => r.json()),
          ),
        );
        group.clearLayers();
        results.forEach((fc: GeoJSON.FeatureCollection, i) => {
          const lvl = levels[i];
          L.geoJSON(fc, {
            pane: "admin",
            interactive: false,
            style: lvl === 2 ? { color: "#ffffff", weight: 1, opacity: 0.55, fill: false } : { color: "#ffffff", weight: 0.7, opacity: 0.35, dashArray: "3 4", fill: false },
          }).addTo(group);
          const inView = map.getBounds();
          let count = 0;
          const cap = lvl === 2 ? 70 : 120;
          for (const f of fc.features) {
            const props = f.properties as { name?: string; label?: [number, number] } | null;
            if (!props?.name || !props.label) continue;
            if (!inView.contains([props.label[1], props.label[0]])) continue;
            if (++count > cap) break;
            L.marker([props.label[1], props.label[0]], {
              pane: "admin",
              interactive: false,
              keyboard: false,
              icon: L.divIcon({ className: lvl === 2 ? "admin-label admin-district" : "admin-label admin-taluk", html: escapeHtml(props.name), iconSize: [0, 0] }),
            }).addTo(group);
          }
        });
      } catch {
        /* aborted or unavailable */
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [viewTick]);

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
    const t = setTimeout(loadGrid, 600);
    return () => clearTimeout(t);
  }, [viewTick, def.gridVar, loadGrid]);

  /* ─── Day / night shading ─────────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => setSunTick((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = shadeRef.current;
    if (!map || !canvas) return;
    // Infrared mode already sits on the night-lights base, so no extra shading there.
    const ir = layer === "satellite" && !!sat && sat.id !== "truecolor";
    if (ir) {
      canvas.style.visibility = "hidden";
      return;
    }
    const size = map.getSize();
    const pad = { x: Math.round(size.x / 2), y: Math.round(size.y / 2) }; // extra margin so panning doesn't reveal edges
    const SCALE = 6; // compute at 1/6 resolution; the browser smooths it when stretching → soft twilight edge
    const W = Math.ceil((size.x + 2 * pad.x) / SCALE);
    const H = Math.ceil((size.y + 2 * pad.y) / SCALE);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * SCALE}px`;
    canvas.style.height = `${H * SCALE}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([-pad.x, -pad.y]));

    const sun = subsolarPoint(new Date());
    const rad = Math.PI / 180;
    const sinD = Math.sin(sun.lat * rad);
    const cosD = Math.cos(sun.lat * rad);
    // Web Mercator: longitude depends only on x, latitude only on y
    const lons = Array.from({ length: W }, (_, x) => map.containerPointToLatLng([x * SCALE - pad.x, 0]).lng);
    const lats = Array.from({ length: H }, (_, y) => map.containerPointToLatLng([0, y * SCALE - pad.y]).lat);
    const cosH = lons.map((lng) => Math.cos((lng - sun.lon) * rad));
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const MAX = 0.62;
    for (let y = 0; y < H; y++) {
      const la = lats[y] * rad;
      const a = Math.sin(la) * sinD;
      const b = Math.cos(la) * cosD;
      for (let x = 0; x < W; x++) {
        const elev = Math.asin(Math.max(-1, Math.min(1, a + b * cosH[x]))) / rad; // sun elevation in degrees
        // full daylight above +2°, deepening through civil/nautical twilight, full night below −12°
        const t = Math.max(0, Math.min(1, (2 - elev) / 14));
        const alpha = MAX * t * t * (3 - 2 * t);
        const i = (y * W + x) * 4;
        img.data[i] = 3;
        img.data[i + 1] = 7;
        img.data[i + 2] = 20;
        img.data[i + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.style.visibility = "visible";
  }, [viewTick, sunTick, layer, sat]);

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

    const step = 6;
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
      ctx.font = "600 10px \"Inter Variable\", Inter, system-ui, -apple-system, Segoe UI, sans-serif";
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
          const tw = ctx.measureText(text).width + 8;
          roundRect(ctx, p.x - tw / 2, p.y - 8, tw, 16, 8);
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
    const dpr = 1; // thin wind lines look the same at 1x and cost 4x less on high-DPI screens
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
    const count = Math.round(Math.min(1800, (size.x * size.y) / 800));
    // Web Mercator: longitude depends only on x, latitude only on y, so precompute both once.
    const lonAt = new Float64Array(size.x + 1);
    const latAt = new Float64Array(size.y + 1);
    for (let x = 0; x <= size.x; x++) lonAt[x] = wrapLon(map.containerPointToLatLng([x, 0]).lng);
    for (let y = 0; y <= size.y; y++) latAt[y] = map.containerPointToLatLng([0, y]).lat;
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
        const lat = latAt[p.y | 0];
        const lon = lonAt[p.x | 0];
        const uu = sample(grid, u, lat, lon);
        const vv = sample(grid, v, lat, lon);
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
        if (nx < 0 || ny < 0 || nx >= size.x || ny >= size.y) particles[i] = { ...spawn(), age: 0 };
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
    radarStack.current?.clear();
    radarStack.current = null;
    if (layer !== "radar" || !radar.length) return;
    radarStack.current = new FrameStack(
      map,
      (i) => L.tileLayer(radar[i].url, { pane: "radar", maxNativeZoom: 7, maxZoom: 15, updateWhenZooming: false, attribution: "Radar © RainViewer" }),
      0.85,
    );
    radarStack.current.show(radarIdx, radar.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, radar]);

  useEffect(() => {
    radarStack.current?.show(radarIdx, radar.length);
  }, [radarIdx, radar]);

  /* ─── Playback ────────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      // Only advance when the next frame has downloaded, so slow connections don't pile up requests.
      if (layer === "radar")
        setRadarIdx((i) => (radar.length && radarStack.current?.ready((i + 1) % radar.length) !== false ? (i + 1) % radar.length : i));
      else if (layer === "satellite")
        setSatIdx((i) => {
          const n = sat?.frames.length ?? 0;
          return n && satStack.current?.ready((i + 1) % n) !== false ? (i + 1) % n : i;
        });
      else if (grid) setTimeIdx((i) => (i + 1) % grid.times.length);
    }, layer === "radar" || layer === "satellite" ? 700 : 1000);
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

/**
 * Animation frames for satellite / radar. Frames are created lazily (current + next only), so the
 * browser downloads one frame at a time instead of every frame at once.
 */
class FrameStack {
  private layers = new Map<number, L.TileLayer>();
  constructor(
    private map: L.Map,
    private make: (i: number) => L.TileLayer,
    private opacity: number,
  ) {}
  private ensure(i: number) {
    if (this.layers.has(i)) return;
    const l = this.make(i);
    l.setOpacity(0);
    l.addTo(this.map);
    this.layers.set(i, l);
  }
  show(i: number, count: number) {
    if (count <= 0) return;
    this.ensure(i);
    if (count > 1) this.ensure((i + 1) % count);
    this.layers.forEach((l, k) => l.setOpacity(k === i ? this.opacity : 0));
  }
  /** true when frame i has finished downloading (or doesn't exist yet and can be created). */
  ready(i: number) {
    const l = this.layers.get(i) as (L.TileLayer & { isLoading?: () => boolean }) | undefined;
    return !l || !l.isLoading || !l.isLoading();
  }
  clear() {
    this.layers.forEach((l) => l.remove());
    this.layers.clear();
  }
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
  // Andrew's monotone-chain convex hull
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

/** GDACS times are UTC; show them in the viewer's local time, e.g. "Fri 30, 05:30". */
function fmtTrackTime(t: string, long = false) {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t.replace("T", " ").slice(5, 16);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-IN", o);
  const hm = part({ hour: "2-digit", minute: "2-digit", hour12: false });
  return long
    ? `${part({ weekday: "long" })}, ${part({ day: "numeric" })} ${part({ month: "short" })} · ${hm}`
    : `${part({ weekday: "short" })} ${part({ day: "numeric" })} ${part({ month: "short" })}, ${hm}`;
}

function cycloneIcon(name: string, cls: ImdClass) {
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="tc-marker" style="--c:${cls.color}"><svg viewBox="0 0 32 32" width="34" height="34"><path d="M16 9.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 3.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" fill="var(--c)" stroke="#fff" stroke-width="1.2"/><path d="M16 9.5C16 5 19.5 2.2 24 2.4c-3 1.4-4.6 3.8-4.6 7.6M16 22.5c0 4.5-3.5 7.3-8 7.1 3-1.4 4.6-3.8 4.6-7.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M16 9.5C16 5 19.5 2.2 24 2.4c-3 1.4-4.6 3.8-4.6 7.6M16 22.5c0 4.5-3.5 7.3-8 7.1 3-1.4 4.6-3.8 4.6-7.6" fill="none" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/></svg><span class="tc-tag">${escapeHtml(name.toUpperCase())}<em>${cls.short}</em></span></div>`,
  });
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
