"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SearchBox } from "@/components/map/SearchBox";
import { StatusBadge } from "@/components/StatusBadge";
import { api, toast } from "@/components/Toast";
import { timeAgo } from "@/lib/time";

type Rule = {
  id: string;
  placeName: string;
  lat: number;
  lon: number;
  metric: string;
  operator: "gt" | "lt";
  threshold: number;
  day: "today" | "tomorrow";
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifySms: boolean;
  active: boolean;
  lastTriggeredAt: string | null;
};
type Note = { id: string; title: string; body: string; createdAt: string; link: string | null };

const METRICS: Record<string, { label: string; unit: string; op: "gt" | "lt"; value: number }> = {
  rain_prob: { label: "Chance of rain", unit: "%", op: "gt", value: 70 },
  precip_sum: { label: "Total rainfall", unit: "mm", op: "gt", value: 20 },
  temp_max: { label: "Maximum temperature", unit: "°C", op: "gt", value: 38 },
  temp_min: { label: "Minimum temperature", unit: "°C", op: "lt", value: 12 },
  wind_max: { label: "Wind speed", unit: "km/h", op: "gt", value: 40 },
  aqi: { label: "Air quality index", unit: "", op: "gt", value: 150 },
};

const PRESETS = [
  { label: "Heavy rain tomorrow", metric: "precip_sum", operator: "gt", threshold: 20, day: "tomorrow" },
  { label: "Heatwave", metric: "temp_max", operator: "gt", threshold: 40, day: "tomorrow" },
  { label: "Strong wind", metric: "wind_max", operator: "gt", threshold: 45, day: "tomorrow" },
  { label: "Unhealthy air", metric: "aqi", operator: "gt", threshold: 150, day: "today" },
  { label: "Cold night", metric: "temp_min", operator: "lt", threshold: 10, day: "tomorrow" },
] as const;

export function AlertsManager({ initial, places, hasPhone, recent }: { initial: Rule[]; places: { name: string; lat: number; lon: number }[]; hasPhone: boolean; recent: Note[] }) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const [place, setPlace] = useState<{ name: string; lat: number; lon: number } | null>(places[0] ?? null);
  const [metric, setMetric] = useState("rain_prob");
  const [operator, setOperator] = useState<"gt" | "lt">("gt");
  const [threshold, setThreshold] = useState(70);
  const [day, setDay] = useState<"today" | "tomorrow">("tomorrow");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [busy, setBusy] = useState(false);

  const pickMetric = (m: string) => {
    setMetric(m);
    setOperator(METRICS[m].op);
    setThreshold(METRICS[m].value);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place) return toast("Pick a place first", "error");
    setBusy(true);
    try {
      const { alert } = await api<{ alert: Rule }>("/api/alerts", {
        method: "POST",
        json: { placeName: place.name, lat: place.lat, lon: place.lon, metric, operator, threshold, day, notifyEmail, notifyInApp, notifySms },
      });
      setRules((r) => [...r, alert]);
      toast("Alert created");
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: Rule) => {
    await api(`/api/alerts/${r.id}`, { method: "PATCH", json: { active: !r.active } });
    setRules((xs) => xs.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)));
  };

  const remove = async (r: Rule) => {
    await api(`/api/alerts/${r.id}`, { method: "DELETE" });
    setRules((xs) => xs.filter((x) => x.id !== r.id));
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <form onSubmit={create} className="card grid gap-5 p-5">
        <h2 className="text-lg font-semibold">New alert</h2>

        <div>
          <span className="label">Quick presets</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.label}
                onClick={() => {
                  setMetric(p.metric);
                  setOperator(p.operator);
                  setThreshold(p.threshold);
                  setDay(p.day);
                }}
                className="chip border border-ink-700 bg-ink-800 px-2.5 py-1 normal-case tracking-normal text-fg-muted hover:text-fg"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Place</span>
          {place ? (
            <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Icon name="pin" size={15} className="text-accent" /> {place.name}
              </span>
              <button type="button" className="text-xs text-accent" onClick={() => setPlace(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <SearchBox variant="plain" onPick={(p) => setPlace({ name: p.name, lat: p.lat, lon: p.lon })} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <button type="button" key={p.name + p.lat} onClick={() => setPlace(p)} className="chip border border-ink-700 bg-ink-800 normal-case tracking-normal text-fg-muted">
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <label className="label" htmlFor="metric">When</label>
            <select id="metric" className="input" value={metric} onChange={(e) => pickMetric(e.target.value)}>
              {Object.entries(METRICS).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="op">is</label>
            <select id="op" className="input" value={operator} onChange={(e) => setOperator(e.target.value as "gt" | "lt")}>
              <option value="gt">above</option>
              <option value="lt">below</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="th">{METRICS[metric].unit || "value"}</label>
            <input id="th" type="number" className="input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} step="any" required />
          </div>
          <div>
            <label className="label" htmlFor="day">for</label>
            <select id="day" className="input" value={day} onChange={(e) => setDay(e.target.value as "today" | "tomorrow")}>
              <option value="today">today</option>
              <option value="tomorrow">tomorrow</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Notify me by</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "app", label: "In-app", v: notifyInApp, set: setNotifyInApp, icon: "bell" as const },
              { k: "email", label: "Email", v: notifyEmail, set: setNotifyEmail, icon: "mail" as const },
              { k: "sms", label: "SMS", v: notifySms, set: setNotifySms, icon: "sms" as const, disabled: !hasPhone },
            ].map((o) => (
              <label key={o.k} className={`flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm ${o.disabled ? "opacity-50" : "cursor-pointer"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={o.v} disabled={o.disabled} onChange={(e) => o.set(e.target.checked)} />
                <Icon name={o.icon} size={15} /> {o.label}
              </label>
            ))}
          </div>
          {!hasPhone && (
            <p className="mt-2 text-xs text-fg-faint">
              Add your mobile number in <Link href="/settings" className="text-accent">Settings</Link> to get SMS alerts.
            </p>
          )}
        </fieldset>

        <button className="btn-primary w-fit" disabled={busy}>
          <Icon name="bell" size={16} /> Create alert
        </button>
      </form>

      <div className="grid content-start gap-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">Your alerts</h2>
          {rules.length === 0 ? (
            <div className="card p-6 text-sm text-fg-muted">No alerts yet.</div>
          ) : (
            <ul className="grid gap-2">
              {rules.map((r) => {
                const m = METRICS[r.metric];
                return (
                  <li key={r.id} className={`card flex items-center gap-3 p-3 ${r.active ? "" : "opacity-60"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {m?.label} {r.operator === "gt" ? ">" : "<"} {r.threshold}
                        {m?.unit} · {r.day}
                      </div>
                      <div className="truncate text-xs text-fg-faint">
                        {r.placeName} · {[r.notifyInApp && "app", r.notifyEmail && "email", r.notifySms && "SMS"].filter(Boolean).join(", ")}
                        {r.lastTriggeredAt && ` · last fired ${timeAgo(r.lastTriggeredAt)}`}
                      </div>
                    </div>
                    <button onClick={() => toggle(r).catch(() => {})} title={r.active ? "Pause" : "Resume"}>
                      <StatusBadge status={r.active ? "ACTIVE" : "PAUSED"} />
                    </button>
                    <button onClick={() => remove(r).catch(() => {})} className="text-fg-faint hover:text-bad" aria-label="Delete alert">
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">Recent notifications</h2>
          {recent.length === 0 ? (
            <div className="card p-6 text-sm text-fg-muted">Nothing yet — you&apos;ll see triggered alerts here.</div>
          ) : (
            <ul className="card divide-y divide-ink-700">
              {recent.map((n) => (
                <li key={n.id} className="p-3">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-fg-muted">{n.body}</div>
                  <div className="mt-0.5 text-[11px] text-fg-faint">{timeAgo(n.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
