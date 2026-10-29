"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryDay, HourPoint } from "@/lib/weather";
import { clock, dateLabel, h12, shortDate } from "@/lib/units";

const conv = (c: number, unit: "C" | "F") => Math.round((unit === "F" ? c * 1.8 + 32 : c) * 10) / 10;

const axis = { stroke: "rgb(var(--fg-faint))", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "rgb(var(--ink-900))",
    border: "1px solid rgb(var(--ink-700))",
    borderRadius: 10,
    fontSize: 12,
    color: "rgb(var(--fg))",
  },
  labelStyle: { color: "rgb(var(--fg-muted))" },
};

export function HourlyChart({ hours, tempUnit, timeFormat }: { hours: HourPoint[]; tempUnit: "C" | "F"; timeFormat: "12" | "24" }) {
  const data = hours.map((h) => ({
    t: `${shortDate(h.time).split(",")[0]} ${timeFormat === "12" ? h12(Number(h.time.slice(11, 13))) : clock(h.time, "24")}`,
    temp: conv(h.temperature, tempUnit),
    feels: conv(h.feelsLike, tempUnit),
    rain: h.precipProb,
  }));
  return (
    <div className="mt-4 h-56 w-full" role="img" aria-label="Hourly temperature and rain chance chart">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59b2f" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f59b2f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--ink-700))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" {...axis} interval={5} />
          <YAxis yAxisId="t" {...axis} unit="°" domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v: number) => String(Math.round(v))} />
          <YAxis yAxisId="r" {...axis} orientation="right" unit="%" domain={[0, 100]} width={36} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="r" dataKey="rain" name="Rain chance %" fill="#4ea8ff" fillOpacity={0.45} radius={[3, 3, 0, 0]} />
          <Area yAxisId="t" type="monotone" dataKey="temp" name={`Temperature °${tempUnit}`} stroke="#f59b2f" strokeWidth={2} fill="url(#tempFill)" />
          <Line yAxisId="t" type="monotone" dataKey="feels" name="Feels like" stroke="#c58cff" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryChart({ days, tempUnit }: { days: HistoryDay[]; tempUnit: "C" | "F" }) {
  const data = days.map((d) => ({
    d: dateLabel(d.date),
    max: conv(d.tempMax, tempUnit),
    min: conv(d.tempMin, tempUnit),
    rain: Math.round(d.precipSum * 10) / 10,
  }));
  return (
    <div className="mt-3 h-56 w-full" role="img" aria-label="Temperature and rainfall over the past week">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--ink-700))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="d" {...axis} />
          <YAxis yAxisId="t" {...axis} unit="°" tickFormatter={(v: number) => String(Math.round(v))} />
          <YAxis yAxisId="r" {...axis} orientation="right" unit="mm" width={44} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="r" dataKey="rain" name="Rainfall mm" fill="#4ea8ff" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
          <Line yAxisId="t" type="monotone" dataKey="max" name="High" stroke="#f5734a" strokeWidth={2} dot={{ r: 2 }} />
          <Line yAxisId="t" type="monotone" dataKey="min" name="Low" stroke="#41c7b9" strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
