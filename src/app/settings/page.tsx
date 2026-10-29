import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="page max-w-3xl">
      <h1 className="h1">Settings</h1>
      <SettingsForm
        name={user.name ?? ""}
        email={user.email ?? ""}
        phone={user.phone ?? ""}
        severe={{ severeInApp: user.severeInApp, severeEmail: user.severeEmail, severeSms: user.severeSms }}
      />
    </div>
  );
}
