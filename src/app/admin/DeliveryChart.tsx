"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DeliveryChart({ data }: { data: { date: string; ok: number; failed: number }[] }) {
  return (
    <div className="mt-4 h-60 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--ink-700))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke="rgb(var(--fg-faint))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="rgb(var(--fg-faint))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "rgb(var(--ink-900))", border: "1px solid rgb(var(--ink-700))", borderRadius: 10, fontSize: 12 }}
            cursor={{ fill: "rgba(127,139,163,0.08)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="ok" name="Delivered / sent" stackId="a" fill="#3ecf8e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="failed" name="Failed / bounced" stackId="a" fill="#ff5a5a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
