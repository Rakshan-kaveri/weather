import type { GridData, GridVar } from "./weather";

export type LayerId = "satellite" | "radar" | "precip" | "wind" | "temp" | "clouds" | "pressure" | "humidity";

type Stop = [number, string, number?]; // value, hex colour, alpha (0-1)

export type LayerDef = {
  id: LayerId;
  label: string;
  icon: "satellite" | "radar" | "rain" | "wind" | "temp" | "cloud" | "pressure" | "humidity";
  gridVar?: GridVar;
  unit: string;
  stops?: Stop[];
  labels?: boolean; // draw numbers on the map
  opacity: number;
};

export const LAYERS: LayerDef[] = [
  { id: "satellite", label: "Satellite", icon: "satellite", unit: "", opacity: 1 },
  { id: "radar", label: "Radar", icon: "radar", unit: "", opacity: 0.85 },
  {
    id: "precip",
    label: "Rain",
    icon: "rain",
    gridVar: "precip",
    unit: "mm/h",
    opacity: 0.85,
    stops: [
      [0.05, "#7fc8ff", 0],
      [0.2, "#7fc8ff", 0.45],
      [1, "#2f8cff", 0.7],
      [3, "#33c46a", 0.8],
      [8, "#f3d23c", 0.85],
      [15, "#ff8a3d", 0.9],
      [30, "#e2335b", 0.9],
      [50, "#b23ad1", 0.9],
    ],
  },
  {
    id: "wind",
    label: "Wind",
    icon: "wind",
    gridVar: "windSpeed",
    unit: "km/h",
    opacity: 0.55,
    labels: true,
    stops: [
      [0, "#2b3a67"],
      [10, "#2f7bbf"],
      [20, "#3fb8a8"],
      [35, "#8fd14f"],
      [50, "#f2c94c"],
      [70, "#f2994a"],
      [90, "#e04f5f"],
      [120, "#b03ac2"],
    ],
  },
  {
    id: "temp",
    label: "Temperature",
    icon: "temp",
    gridVar: "temp",
    unit: "°C",
    opacity: 0.6,
    labels: true,
    stops: [
      [-25, "#6a3fb5"],
      [-10, "#3b5bdb"],
      [0, "#3aa0e8"],
      [10, "#41c7b9"],
      [18, "#7fd36b"],
      [24, "#e8dd4a"],
      [30, "#f59b2f"],
      [36, "#e2492f"],
      [44, "#9d1c3f"],
    ],
  },
  {
    id: "clouds",
    label: "Clouds",
    icon: "cloud",
    gridVar: "clouds",
    unit: "%",
    opacity: 0.9,
    stops: [
      [5, "#ffffff", 0],
      [40, "#e8eef8", 0.35],
      [80, "#f4f7fc", 0.65],
      [100, "#ffffff", 0.82],
    ],
  },
  {
    id: "pressure",
    label: "Pressure",
    icon: "pressure",
    gridVar: "pressure",
    unit: "hPa",
    opacity: 0.55,
    labels: true,
    stops: [
      [980, "#7b3fbf"],
      [995, "#3a6fd8"],
      [1005, "#41b6c4"],
      [1012, "#8bd16a"],
      [1018, "#f0d34a"],
      [1026, "#f08a3a"],
      [1038, "#d9435a"],
    ],
  },
  {
    id: "humidity",
    label: "Humidity",
    icon: "humidity",
    gridVar: "humidity",
    unit: "%",
    opacity: 0.55,
    stops: [
      [0, "#c9862f"],
      [30, "#e8cf6a"],
      [60, "#59c7a8"],
      [80, "#2f86d6"],
      [100, "#3a3fb5"],
    ],
  },
];

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Precomputed colour lookup: returns [r,g,b,a] (a 0-255) for a value. */
export function makeScale(stops: Stop[]) {
  const rgb = stops.map((s) => hexToRgb(s[1]));
  return (v: number): [number, number, number, number] => {
    if (v <= stops[0][0]) {
      const a = stops[0][2] ?? 1;
      return [rgb[0][0], rgb[0][1], rgb[0][2], a * 255];
    }
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        const a0 = stops[i - 1][2] ?? 1;
        const a1 = stops[i][2] ?? 1;
        return [
          rgb[i - 1][0] + (rgb[i][0] - rgb[i - 1][0]) * t,
          rgb[i - 1][1] + (rgb[i][1] - rgb[i - 1][1]) * t,
          rgb[i - 1][2] + (rgb[i][2] - rgb[i - 1][2]) * t,
          (a0 + (a1 - a0) * t) * 255,
        ];
      }
    }
    const last = stops.length - 1;
    return [rgb[last][0], rgb[last][1], rgb[last][2], (stops[last][2] ?? 1) * 255];
  };
}

export function cssGradient(stops: Stop[]) {
  const min = stops[0][0];
  const max = stops[stops.length - 1][0];
  return `linear-gradient(90deg, ${stops
    .map((s) => {
      const [r, g, b] = hexToRgb(s[1]);
      return `rgba(${r},${g},${b},${Math.max(0.35, s[2] ?? 1)}) ${(((s[0] - min) / (max - min)) * 100).toFixed(1)}%`;
    })
    .join(", ")})`;
}

/** Bilinear sample of a grid variable at a coordinate. Returns NaN outside the grid. */
export function sample(grid: GridData, values: number[], lat: number, lon: number) {
  const [w, s, e, n] = grid.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return NaN;
  const fx = ((lon - w) / (e - w)) * (grid.cols - 1);
  const fy = ((n - lat) / (n - s)) * (grid.rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, grid.cols - 1);
  const y1 = Math.min(y0 + 1, grid.rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = values[y0 * grid.cols + x0];
  const v10 = values[y0 * grid.cols + x1];
  const v01 = values[y1 * grid.cols + x0];
  const v11 = values[y1 * grid.cols + x1];
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/** u/v wind components (km/h) for each grid point at a time index. */
export function windComponents(grid: GridData, t: number) {
  const sp = grid.values.windSpeed[t];
  const dir = grid.values.windDir[t];
  const u = new Array<number>(sp.length);
  const v = new Array<number>(sp.length);
  for (let i = 0; i < sp.length; i++) {
    const rad = (dir[i] * Math.PI) / 180;
    // Meteorological direction = where the wind comes FROM.
    u[i] = -sp[i] * Math.sin(rad);
    v[i] = -sp[i] * Math.cos(rad);
  }
  return { u, v };
}
