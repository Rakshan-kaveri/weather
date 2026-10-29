"use client";

import { useState } from "react";
import { usePrefs } from "@/components/Providers";
import { api, toast } from "@/components/Toast";
import type { Prefs } from "@/lib/units";
import { Icon } from "@/components/Icon";

type Severe = { severeInApp: boolean; severeEmail: boolean; severeSms: boolean };

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-ink-700 bg-ink-800 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-sm ${value === o.v ? "bg-accent text-white" : "text-fg-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsForm({ name: initialName, email, phone: initialPhone, severe: initialSevere }: { name: string; email: string; phone: string; severe: Severe }) {
  const [severe, setSevere] = useState<Severe>(initialSevere);
  const toggleSevere = async (k: keyof Severe) => {
    const next = { ...severe, [k]: !severe[k] };
    try {
      await api("/api/settings", { method: "PATCH", json: { [k]: next[k] } });
      setSevere(next);
      toast("Warning settings saved");
    } catch {
      /* toast shown */
    }
  };
  const { prefs, setPrefs } = usePrefs();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api<{ phone: string | null }>("/api/settings", { method: "PATCH", json: { name, phone: phone || null } });
      setPhone(r.phone ?? "");
      toast("Profile saved");
    } catch {
      /* toast shown */
    } finally {
      setSaving(false);
    }
  };

  const row = "flex flex-col gap-2 border-b border-ink-700 py-4 sm:flex-row sm:items-center sm:justify-between";

  return (
    <div className="mt-6 grid gap-6">
      <section className="card px-5">
        <h2 className="pt-5 text-sm font-semibold uppercase tracking-wider text-fg-muted">Display</h2>
        <div className={row}>
          <div>
            <div className="font-medium">Temperature</div>
            <div className="text-xs text-fg-faint">Used everywhere on the site</div>
          </div>
          <Segmented<Prefs["tempUnit"]> label="Temperature unit" value={prefs.tempUnit} onChange={(v) => setPrefs({ tempUnit: v })} options={[{ v: "C", label: "°C" }, { v: "F", label: "°F" }]} />
        </div>
        <div className={row}>
          <div className="font-medium">Wind speed</div>
          <Segmented<Prefs["windUnit"]>
            label="Wind unit"
            value={prefs.windUnit}
            onChange={(v) => setPrefs({ windUnit: v })}
            options={[
              { v: "kmh", label: "km/h" },
              { v: "ms", label: "m/s" },
              { v: "mph", label: "mph" },
              { v: "kn", label: "knots" },
            ]}
          />
        </div>
        <div className={row}>
          <div className="font-medium">Time format</div>
          <Segmented<Prefs["timeFormat"]> label="Time format" value={prefs.timeFormat} onChange={(v) => setPrefs({ timeFormat: v })} options={[{ v: "24", label: "24-hour" }, { v: "12", label: "12-hour" }]} />
        </div>
        <div className={`${row} border-b-0`}>
          <div>
            <div className="font-medium">Theme</div>
            <div className="text-xs text-fg-faint">The live map always stays dark</div>
          </div>
          <Segmented<Prefs["theme"]> label="Theme" value={prefs.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ v: "dark", label: "Dark" }, { v: "light", label: "Light" }]} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
          <Icon name="storm" size={16} className="text-warn" /> Severe weather warnings
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          We watch every place you&apos;ve saved or subscribed to and warn you before thunderstorms, heavy rain (IMD categories), strong winds or a
          nearby cyclone hit. Checked every 30 minutes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["severeInApp", "In-app", "bell"],
              ["severeEmail", "Email", "mail"],
              ["severeSms", "SMS", "sms"],
            ] as const
          ).map(([k, label, icon]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={severe[k]} onChange={() => toggleSevere(k)} />
              <Icon name={icon} size={15} /> {label}
            </label>
          ))}
        </div>
        {!phone && <p className="mt-2 text-xs text-fg-faint">Add your mobile number below to receive SMS warnings.</p>}
      </section>

      <form onSubmit={saveProfile} className="card grid gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div>
            <label className="label" htmlFor="em">Email (from Google)</label>
            <input id="em" className="input opacity-70" value={email} readOnly />
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile number (for SMS)</label>
            <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
          </div>
        </div>
        <button className="btn-primary w-fit" disabled={saving}>
          Save profile
        </button>
      </form>

      <section className="card p-5 text-sm text-fg-muted">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">Your data</h2>
        We store your Google name, email and photo, your saved places, report and alert settings, and the approximate city you last signed in
        from (to help keep your account secure). See the <a href="/privacy" className="text-accent">privacy page</a> for details.
      </section>
    </div>
  );
}
