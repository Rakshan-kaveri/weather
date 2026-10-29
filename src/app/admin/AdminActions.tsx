"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { api, toast } from "@/components/Toast";

export function ResendButton({ subscriptionId, label = "Resend now" }: { subscriptionId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      className="btn-ghost px-2.5 py-1 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/admin/resend", { method: "POST", json: { subscriptionId } });
          toast("Sent");
          router.refresh();
        } catch {
          /* toast shown */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="send" size={13} /> {busy ? "Sending…" : label}
    </button>
  );
}

export function PreviewButton({ subscriptionId }: { subscriptionId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost px-2.5 py-1 text-xs"
      disabled={busy}
      title="Email a preview of this report to yourself"
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/admin/test-email", { method: "POST", json: { subscriptionId } });
          toast("Preview sent to your inbox");
        } catch {
          /* toast shown */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="mail" size={13} /> Preview
    </button>
  );
}

export function RunJobButton({ job, label }: { job: "daily-reports" | "alerts" | "severe-weather"; label: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      className="btn-ghost py-1.5 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ result: { processed: number; sent: number; failed: number } }>("/api/admin/run", { method: "POST", json: { job } });
          toast(`${label}: ${r.result.sent} sent, ${r.result.failed} failed`);
          router.refresh();
        } catch {
          /* toast shown */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="refresh" size={13} /> {busy ? "Running…" : label}
    </button>
  );
}

export function UserActions({ id, blocked, role, self }: { id: string; blocked: boolean; role: string; self: boolean }) {
  const router = useRouter();
  const update = async (data: Record<string, unknown>) => {
    await api(`/api/admin/users/${id}`, { method: "PATCH", json: data });
    router.refresh();
  };
  if (self) return <span className="text-xs text-fg-faint">You</span>;
  return (
    <div className="flex gap-1.5">
      <button className={blocked ? "btn-ghost px-2.5 py-1 text-xs" : "btn-danger px-2.5 py-1 text-xs"} onClick={() => update({ blocked: !blocked }).catch(() => {})}>
        {blocked ? "Unblock" : "Block"}
      </button>
      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => update({ role: role === "ADMIN" ? "USER" : "ADMIN" }).catch(() => {})}>
        {role === "ADMIN" ? "Remove admin" : "Make admin"}
      </button>
    </div>
  );
}

export function SubToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <button
      className="btn-ghost px-2.5 py-1 text-xs"
      onClick={async () => {
        await api("/api/admin/subscriptions", { method: "PATCH", json: { id, active: !active } }).catch(() => {});
        router.refresh();
      }}
    >
      {active ? "Pause" : "Resume"}
    </button>
  );
}
