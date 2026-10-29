"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { GoogleG } from "@/components/Header";
import { Icon, type IconName } from "@/components/Icon";

const PERKS: { icon: IconName; text: string }[] = [
  { icon: "pin", text: "Save home, hostel and your village — switch in one tap" },
  { icon: "mail", text: "Daily weather by email or SMS at the time you choose" },
  { icon: "bell", text: "Alerts for heavy rain, heat, wind and bad air" },
  { icon: "leaf", text: "Farmer mode: spraying and irrigation advice in Kannada, Hindi or English" },
];

const ERRORS: Record<string, string> = {
  blocked: "This account has been disabled. Contact the site admin.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Callback: "Google sign-in didn't complete. Please try again.",
};

export function LoginCard({ next, error }: { next: string; error?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="card relative w-full max-w-md p-7 shadow-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to SkyCast</h1>
      <p className="mt-1 text-sm text-fg-muted">The map and forecasts are free for everyone. Sign in to personalise them.</p>

      {error && <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{ERRORS[error] ?? "Sign-in failed. Please try again."}</div>}

      <button
        onClick={() => {
          setLoading(true);
          signIn("google", { callbackUrl: next });
        }}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-ink-600 bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
      >
        <GoogleG /> {loading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <ul className="mt-6 space-y-3">
        {PERKS.map((p) => (
          <li key={p.text} className="flex items-start gap-3 text-sm text-fg-muted">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
              <Icon name={p.icon} size={15} />
            </span>
            {p.text}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-fg-faint">
        By continuing you agree to our <a href="/privacy" className="text-accent">privacy notice</a>. We store your approximate sign-in city to
        protect your account.
      </p>
    </div>
  );
}
