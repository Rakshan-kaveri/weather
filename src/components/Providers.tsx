"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PREFS, type Prefs } from "@/lib/units";

type PrefsCtx = { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; signedIn: boolean };
const PrefsContext = createContext<PrefsCtx>({ prefs: DEFAULT_PREFS, setPrefs: () => {}, signedIn: false });

export function usePrefs() {
  return useContext(PrefsContext);
}

const KEY = "skycast:prefs";

export function Providers({ children, initialPrefs, signedIn }: { children: React.ReactNode; initialPrefs?: Prefs; signedIn: boolean }) {
  const [prefs, setState] = useState<Prefs>(initialPrefs ?? DEFAULT_PREFS);

  // Guests keep their preferences in this browser.
  useEffect(() => {
    if (signedIn) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable */
    }
  }, [signedIn]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-light", prefs.theme === "light");
    root.classList.toggle("theme-dark", prefs.theme !== "light");
  }, [prefs.theme]);

  const setPrefs = useCallback(
    (p: Partial<Prefs>) => {
      setState((prev) => {
        const next = { ...prev, ...p };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      if (signedIn) {
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        }).catch(() => {});
      }
    },
    [signedIn],
  );

  const value = useMemo(() => ({ prefs, setPrefs, signedIn }), [prefs, setPrefs, signedIn]);

  return (
    <SessionProvider>
      <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
    </SessionProvider>
  );
}
