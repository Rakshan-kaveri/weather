"use client";

import { useState } from "react";
import { SearchBox } from "./map/SearchBox";
import { Icon } from "./Icon";
import { LANG_NAMES } from "@/lib/i18n";

export type SubForm = {
  channel: "EMAIL" | "SMS";
  email: string;
  phone: string;
  contactName: string;
  placeName: string;
  lat: number | null;
  lon: number | null;
  timezone: string;
  sendTime: string;
  days: number[];
  forecastDay: "today" | "tomorrow";
  format: "short" | "detailed";
  language: "en" | "kn" | "hi";
  includeTemp: boolean;
  includeRain: boolean;
  includeWind: boolean;
  includeAqi: boolean;
  includeTips: boolean;
  farmerTips: boolean;
};

export function emptyForm(tz: string, overrides: Partial<SubForm> = {}): SubForm {
  return {
    channel: "EMAIL",
    email: "",
    phone: "",
    contactName: "",
    placeName: "",
    lat: null,
    lon: null,
    timezone: tz,
    sendTime: "07:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    forecastDay: "today",
    format: "detailed",
    language: "en",
    includeTemp: true,
    includeRain: true,
    includeWind: true,
    includeAqi: true,
    includeTips: true,
    farmerTips: false,
    ...overrides,
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export function SubscriptionFields({
  form,
  set,
  places,
  smsAvailable,
  showContactName = false,
  lockChannel,
}: {
  form: SubForm;
  set: (p: Partial<SubForm>) => void;
  places: { name: string; lat: number; lon: number }[];
  smsAvailable: boolean;
  showContactName?: boolean;
  lockChannel?: "EMAIL" | "SMS";
}) {
  const [changingPlace, setChangingPlace] = useState(!form.placeName);
  const toggleDay = (d: number) => set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d].sort() });

  return (
    <div className="grid gap-5">
      {!lockChannel && (
        <fieldset>
          <legend className="label">Send by</legend>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {(["EMAIL", "SMS"] as const).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set({ channel: c, format: c === "SMS" ? "short" : form.format })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                  form.channel === c ? "border-accent bg-accent/10 text-accent" : "border-ink-700 bg-ink-800 text-fg-muted hover:text-fg"
                }`}
                aria-pressed={form.channel === c}
              >
                <Icon name={c === "EMAIL" ? "mail" : "sms"} size={16} /> {c === "EMAIL" ? "Email" : "SMS"}
              </button>
            ))}
          </div>
          {form.channel === "SMS" && !smsAvailable && (
            <p className="mt-2 text-xs text-warn">SMS sending isn&apos;t switched on yet on this server — your report will be saved and start once it is.</p>
          )}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {showContactName && (
          <div>
            <label className="label" htmlFor="contactName">Name</label>
            <input id="contactName" className="input" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="e.g. Ramesh Gowda" />
          </div>
        )}
        {form.channel === "EMAIL" ? (
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" type="email" className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="phone">Mobile number</label>
            <input id="phone" type="tel" inputMode="tel" className="input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="98765 43210" />
          </div>
        )}
      </div>

      <div>
        <span className="label">Place</span>
        {form.placeName && !changingPlace ? (
          <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Icon name="pin" size={15} className="text-accent" /> {form.placeName}
            </span>
            <button type="button" className="text-xs text-accent" onClick={() => setChangingPlace(true)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <SearchBox
              variant="plain"
              onPick={(p) => {
                set({ placeName: p.name, lat: p.lat, lon: p.lon });
                setChangingPlace(false);
              }}
            />
            {places.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <button
                    type="button"
                    key={p.name + p.lat}
                    onClick={() => {
                      set({ placeName: p.name, lat: p.lat, lon: p.lon });
                      setChangingPlace(false);
                    }}
                    className="chip border border-ink-700 bg-ink-800 normal-case tracking-normal text-fg-muted hover:text-fg"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="time">Send at</label>
          <input id="time" type="time" className="input" value={form.sendTime} onChange={(e) => set({ sendTime: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="tz">Timezone</label>
          <select id="tz" className="input" value={form.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fday">Forecast for</label>
          <select id="fday" className="input" value={form.forecastDay} onChange={(e) => set({ forecastDay: e.target.value as SubForm["forecastDay"] })}>
            <option value="today">The same day</option>
            <option value="tomorrow">The next day</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">On these days</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDay(i)}
              aria-pressed={form.days.includes(i)}
              className={`h-9 w-12 rounded-lg border text-sm ${form.days.includes(i) ? "border-accent bg-accent/10 text-accent" : "border-ink-700 bg-ink-800 text-fg-muted"}`}
            >
              {d}
            </button>
          ))}
          <button type="button" className="ml-1 text-xs text-accent" onClick={() => set({ days: [1, 2, 3, 4, 5] })}>
            Weekdays
          </button>
          <button type="button" className="text-xs text-accent" onClick={() => set({ days: [0, 1, 2, 3, 4, 5, 6] })}>
            Every day
          </button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="format">Format</label>
          <select id="format" className="input" value={form.format} onChange={(e) => set({ format: e.target.value as SubForm["format"] })}>
            <option value="short">Short — the essentials</option>
            <option value="detailed">Detailed — morning/afternoon/evening, sun times</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lang">Language</label>
          <select id="lang" className="input" value={form.language} onChange={(e) => set({ language: e.target.value as SubForm["language"] })}>
            {Object.entries(LANG_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Include</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["includeTemp", "Temperature"],
              ["includeRain", "Rain chance & amount"],
              ["includeWind", "Wind"],
              ["includeAqi", "Air quality"],
              ["includeTips", "Umbrella / heat tips"],
              ["farmerTips", "Farmer advice"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={form[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<SubForm>)} />
              {k === "farmerTips" && <Icon name="leaf" size={15} className="text-good" />}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function formToPayload(f: SubForm) {
  return {
    channel: f.channel,
    email: f.channel === "EMAIL" ? f.email || null : null,
    phone: f.channel === "SMS" ? f.phone || null : null,
    contactName: f.contactName || null,
    placeName: f.placeName,
    lat: f.lat,
    lon: f.lon,
    timezone: f.timezone,
    sendTime: f.sendTime,
    days: f.days,
    forecastDay: f.forecastDay,
    format: f.format,
    language: f.language,
    includeTemp: f.includeTemp,
    includeRain: f.includeRain,
    includeWind: f.includeWind,
    includeAqi: f.includeAqi,
    includeTips: f.includeTips,
    farmerTips: f.farmerTips,
  };
}
