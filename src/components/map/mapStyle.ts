import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Base map: Esri satellite imagery underneath, with sharp vector borders and place names from OpenFreeMap
 * (OpenStreetMap data, no API key). Weather overlays are slotted between the imagery and the labels.
 */
export const OFM = "https://tiles.openfreemap.org";
export const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const NIGHT_LIGHTS =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png";

/** Web-Mercator latitude limit (image sources must stay inside it). */
export const MERC_MAX = 85.0511;
export const EMPTY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
export const WORLD: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, MERC_MAX],
  [180, MERC_MAX],
  [180, -MERC_MAX],
  [-180, -MERC_MAX],
];

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];
const REGULAR = ["Noto Sans Regular"];
const BOLD = ["Noto Sans Bold"];
const HALO = { "text-halo-color": "rgba(0,0,0,0.78)", "text-halo-width": 1.3, "text-halo-blur": 0.4 };
const EMPTY_FC = { type: "geojson" as const, data: { type: "FeatureCollection" as const, features: [] } };

/** Placeholder layers that mark where animated frame layers get inserted. */
export const SLOT_SAT = "slot-sat";
export const SLOT_RADAR = "slot-radar";
const slot = (id: string) => ({ id, type: "background" as const, layout: { visibility: "none" as const }, paint: { "background-color": "#000" } });

export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      imagery: {
        type: "raster",
        tiles: [ESRI_IMAGERY],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
      night: { type: "raster", tiles: [NIGHT_LIGHTS], tileSize: 256, maxzoom: 8, attribution: "Night lights: NASA Black Marble" },
      omt: { type: "vector", url: `${OFM}/planet`, attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © OpenStreetMap contributors' },
      shade: { type: "image", url: EMPTY_PNG, coordinates: WORLD },
      heat: { type: "image", url: EMPTY_PNG, coordinates: WORLD },
      values: EMPTY_FC,
      adm: { ...EMPTY_FC, attribution: "Boundaries: geoBoundaries (CC BY 4.0)" },
      admLabels: EMPTY_FC,
      tcCone: { ...EMPTY_FC, attribution: "Cyclones: GDACS" },
      tcTrack: EMPTY_FC,
      tcPts: EMPTY_FC,
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#04060b" } },
      { id: "imagery", type: "raster", source: "imagery", paint: { "raster-fade-duration": 150, "raster-saturation": -0.1, "raster-brightness-max": 0.92 } },
      { id: "night", type: "raster", source: "night", layout: { visibility: "none" }, paint: { "raster-fade-duration": 0 } },
      { id: "shade", type: "raster", source: "shade", paint: { "raster-fade-duration": 0, "raster-resampling": "linear" } },
      slot(SLOT_SAT),
      { id: "heat", type: "raster", source: "heat", paint: { "raster-fade-duration": 0, "raster-resampling": "linear", "raster-opacity": 0.6 } },
      slot(SLOT_RADAR),

      // districts / taluks (our own API, zoom 6+)
      {
        id: "adm3-line",
        type: "line",
        source: "adm",
        filter: ["==", ["get", "level"], 3],
        paint: { "line-color": "rgba(255,255,255,0.34)", "line-width": 0.6, "line-dasharray": [2, 2] },
      },
      { id: "adm2-line", type: "line", source: "adm", filter: ["==", ["get", "level"], 2], paint: { "line-color": "rgba(255,255,255,0.55)", "line-width": 0.9 } },

      // state & country borders (OpenStreetMap)
      {
        id: "border-state",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", [">=", ["get", "admin_level"], 3], ["<=", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": "rgba(255,255,255,0.5)", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 1.1] },
      },
      {
        id: "border-country",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
        layout: { "line-join": "round" },
        paint: { "line-color": "rgba(255,255,255,0.88)", "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.7] },
      },

      // cyclone cone & track
      { id: "tc-cone", type: "fill", source: "tcCone", paint: { "fill-color": "#d9dee8", "fill-opacity": 0.2 } },
      { id: "tc-cone-line", type: "line", source: "tcCone", paint: { "line-color": "#ffffff", "line-opacity": 0.22, "line-width": 1 } },
      {
        id: "tc-track-casing",
        type: "line",
        source: "tcTrack",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-opacity": 0.35, "line-width": 5 },
      },
      {
        id: "tc-track",
        type: "line",
        source: "tcTrack",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-opacity": ["get", "opacity"], "line-width": 2.6 },
      },
      {
        id: "tc-pts",
        type: "circle",
        source: "tcPts",
        paint: {
          "circle-radius": 5,
          "circle-color": ["case", ["get", "forecast"], "#ffffff", ["get", "color"]],
          "circle-stroke-color": ["case", ["get", "forecast"], ["get", "color"], "rgba(0,0,0,0.6)"],
          "circle-stroke-width": ["case", ["get", "forecast"], 2, 1.5],
        },
      },

      // place names (OpenStreetMap)
      {
        id: "label-country",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        maxzoom: 7,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": NAME,
          "text-font": BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10, 6, 14],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 8,
        },
        paint: { "text-color": "#ffffff", ...HALO },
      },
      {
        id: "label-state",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 4,
        maxzoom: 9,
        filter: ["==", ["get", "class"], "state"],
        layout: { "text-field": NAME, "text-font": REGULAR, "text-size": 10.5, "text-transform": "uppercase", "text-letter-spacing": 0.12, "text-max-width": 8 },
        paint: { "text-color": "rgba(255,255,255,0.72)", ...HALO },
      },
      {
        id: "label-city",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 3.5,
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-field": NAME,
          "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 15],
          "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
        },
        paint: { "text-color": "#ffffff", ...HALO },
      },
      {
        id: "label-town",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 6.5,
        filter: ["==", ["get", "class"], "town"],
        layout: { "text-field": NAME, "text-font": REGULAR, "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10.5, 12, 13] },
        paint: { "text-color": "rgba(255,255,255,0.92)", ...HALO },
      },
      {
        id: "label-village",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 9.5,
        filter: ["==", ["get", "class"], "village"],
        layout: { "text-field": NAME, "text-font": REGULAR, "text-size": 10.5 },
        paint: { "text-color": "rgba(255,255,255,0.82)", ...HALO },
      },
      {
        id: "adm-label",
        type: "symbol",
        source: "admLabels",
        layout: {
          "text-field": ["get", "name"],
          "text-font": REGULAR,
          "text-size": ["case", ["==", ["get", "level"], 2], 10.5, 9.5],
          "text-transform": ["case", ["==", ["get", "level"], 2], "uppercase", "none"],
          "text-letter-spacing": ["case", ["==", ["get", "level"], 2], 0.08, 0],
          "symbol-sort-key": ["get", "level"],
        },
        paint: { "text-color": ["case", ["==", ["get", "level"], 2], "rgba(255,255,255,0.78)", "rgba(255,255,255,0.6)"], ...HALO },
      },

      // numbers on the weather field
      {
        id: "values",
        type: "symbol",
        source: "values",
        layout: { "text-field": ["get", "text"], "text-font": BOLD, "text-size": 11, "text-padding": 28 },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.6)", "text-halo-width": 1.6 },
      },

      // cyclone date/time labels
      {
        id: "tc-time",
        type: "symbol",
        source: "tcPts",
        filter: ["has", "label"],
        layout: {
          "text-field": ["get", "label"],
          "text-font": REGULAR,
          "text-size": 10,
          "text-anchor": "left",
          "text-offset": [0.9, 0],
          "text-optional": true,
        },
        paint: { "text-color": ["case", ["get", "forecast"], "#c8cfdb", "#e8edf6"], "text-halo-color": "rgba(10,14,22,0.85)", "text-halo-width": 2 },
      },
    ],
  };
}
