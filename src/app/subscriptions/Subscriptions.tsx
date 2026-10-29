"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { api, toast } from "@/components/Toast";
import { SubscriptionFields, emptyForm, formToPayload, type SubForm } from "@/components/SubscriptionForm";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { timeAgo } from "@/lib/time";

type Delivery = { id: string; status: string; createdAt: string; error: string | null; kind: string };
type Sub = {
  id: string;
  channel: "EMAIL" | "SMS";
  email: string | null;
  phone: string | null;
  placeName: string;
  lat: number;
  lon: number;
  timezone: string;
  sendTime: string;
  days: number[];
  forecastDay: "today" | "tomorrow";
  format: "short" | "detailed";
  language: Lang;
  includeTemp: boolean;
  includeRain: boolean;
  includeWind: boolean;
  includeAqi: boolean;
  includeTips: boolean;
  farmerTips: boolean;
  active: boolean;
  lastSentAt: string | null;
  deliveries: Delivery[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysLabel(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

export function Subscriptions({
  initial,
  places,
  userEmail,
  userPhone,
  prefill,
  smsAvailable,
  defaultTimezone,
}: {
  initial: Sub[];
  places: { name: string; lat: number; lon: number }[];
  userEmail: string;
  userPhone: string;
  prefill: { lat: number; lon: number; name: string } | null;
  smsAvailable: boolean;
  defaultTimezone: string;
}) {
  const fresh = () =>
    emptyForm(defaultTimezone, {
      email: userEmail,
      phone: userPhone,
      ...(prefill ? { placeName: prefill.name, lat: prefill.lat, lon: prefill.lon } : places[0] ? { placeName: places[0].name, lat: places[0].lat, lon: places[0].lon } : {}),
    });

  const [subs, setSubs] = useState<Sub[]>(initial);
  const [form, setForm] = useState<SubForm | null>(initial.length === 0 || prefill ? fresh() : null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (p: Partial<SubForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.lat == null || form.lon == null) return toast("Pick a place first", "error");
    setBusy(true);
    try {
      if (editingId) {
        const { subscription } = await api<{ subscription: Sub }>(`/api/subscriptions/${editingId}`, { method: "PATCH", json: formToPayload(form) });
        setSubs((s) => s.map((x) => (x.id === editingId ? { ...x, ...subscription } : x)));
        toast("Report updated");
      } else {
        const { subscription } = await api<{ subscription: Sub }>("/api/subscriptions", { method: "POST", json: formToPayload(form) });
        setSubs((s) => [...s, { ...subscription, deliveries: [] }]);
        toast(`Done — you'll get ${form.placeName} weather at ${form.sendTime}`);
      }
      setForm(null);
      setEditingId(null);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  const edit = (s: Sub) => {
    setEditingId(s.id);
    setForm({
      ...emptyForm(s.timezone),
      ...s,
      email: s.email ?? "",
      phone: s.phone ?? "",
      contactName: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (s: Sub) => {
    await api(`/api/subscriptions/${s.id}`, { method: "PATCH", json: { active: !s.active } });
    setSubs((xs) => xs.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
  };

  const remove = async (s: Sub) => {
    if (!confirm(`Delete the ${s.placeName} report?`)) return;
    await api(`/api/subscriptions/${s.id}`, { method: "DELETE" });
    setSubs((xs) => xs.filter((x) => x.id !== s.id));
  };

  const test = async (s: Sub) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${s.id}/test`, { method: "POST" });
      toast(s.channel === "EMAIL" ? `Test email sent to ${s.email}` : `Test SMS sent to ${s.phone}`);
      setSubs((xs) =>
        xs.map((x) => (x.id === s.id ? { ...x, lastSentAt: new Date().toISOString(), deliveries: [{ id: "new", status: "SENT", createdAt: new Date().toISOString(), error: null, kind: "test" }, ...x.deliveries].slice(0, 3) } : x)),
      );
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 grid gap-6">
      {form ? (
        <form onSubmit={submit} className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? "Edit report" : "New daily report"}</h2>
            {(subs.length > 0 || editingId) && (
              <button
                type="button"
                className="text-sm text-fg-muted hover:text-fg"
                onClick={() => {
                  setForm(null);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <SubscriptionFields form={form} set={set} places={places} smsAvailable={smsAvailable} lockChannel={editingId ? form.channel : undefined} />
          <div className="mt-6 flex justify-end">
            <button className="btn-primary" disabled={busy}>
              <Icon name="check" size={16} /> {editingId ? "Save changes" : "Start my daily report"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setForm(fresh())} className="btn-primary w-fit">
          <Icon name="plus" size={16} /> New report
        </button>
      )}

      {subs.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">Your reports</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {subs.map((s) => {
              const last = s.deliveries[0];
              return (
                <li key={s.id} className={`card p-4 ${s.active ? "" : "opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold">
                        <Icon name={s.channel === "EMAIL" ? "mail" : "sms"} size={16} className="text-accent" />
                        <span className="truncate">{s.placeName}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-fg-faint">{s.channel === "EMAIL" ? s.email : s.phone}</p>
                    </div>
                    <StatusBadge status={s.active ? "ACTIVE" : "PAUSED"} />
                  </div>
                  <p className="mt-3 text-sm text-fg-muted">
                    {s.sendTime} · {daysLabel(s.days)} · {s.forecastDay === "today" ? "same-day" : "next-day"} forecast · {s.format} ·{" "}
                    {LANG_NAMES[s.language]?.split(" ")[0]}
                    {s.farmerTips && " · farmer advice"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-fg-faint">
                    Last sent: {timeAgo(s.lastSentAt)}
                    {last && <StatusBadge status={last.status} title={last.error ?? undefined} />}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-700 pt-3">
                    <button onClick={() => test(s)} disabled={busy} className="btn-ghost py-1.5">
                      <Icon name="send" size={14} /> Send now
                    </button>
                    <button onClick={() => edit(s)} className="btn-ghost py-1.5">
                      Edit
                    </button>
                    <button onClick={() => toggle(s).catch(() => {})} className="btn-ghost py-1.5">
                      {s.active ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => remove(s).catch(() => {})} className="btn-danger ml-auto py-1.5" aria-label="Delete report">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
