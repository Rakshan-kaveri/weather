"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SubscriptionFields, emptyForm, formToPayload, type SubForm } from "@/components/SubscriptionForm";
import { api, toast } from "@/components/Toast";

/** Lets an admin register SMS-only subscribers — e.g. farmers with a basic phone and no Google account. */
export function AddFarmer({ smsAvailable, defaultTimezone }: { smsAvailable: boolean; defaultTimezone: string }) {
  const router = useRouter();
  const blank = () => emptyForm(defaultTimezone, { channel: "SMS", format: "short", language: "kn", farmerTips: true, includeAqi: false, sendTime: "06:30" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SubForm>(blank);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<SubForm>) => setForm((f) => ({ ...f, ...p }));

  if (!open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Icon name="leaf" size={16} className="text-good" /> Register an SMS subscriber
          </div>
          <p className="text-sm text-fg-muted">For farmers and rural users with a basic phone — no smartphone or Google account needed.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} /> Add subscriber
        </button>
      </div>
    );
  }

  return (
    <form
      className="card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (form.lat == null) return toast("Pick their village or town", "error");
        setBusy(true);
        try {
          await api("/api/admin/subscriptions", { method: "POST", json: formToPayload(form) });
          toast(`${form.contactName} will get SMS at ${form.sendTime}`);
          setForm(blank());
          setOpen(false);
          router.refresh();
        } catch {
          /* toast shown */
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">New SMS subscriber</h2>
        <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <SubscriptionFields form={form} set={set} places={[]} smsAvailable={smsAvailable} showContactName lockChannel="SMS" />
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" disabled={busy}>
          <Icon name="check" size={16} /> Register
        </button>
      </div>
    </form>
  );
}
