"use client";

import { useEffect } from "react";

/**
 * Tells the server once per browser session that the user is here, so the admin panel can show
 * last sign-in time and approximate location. Uses the IP-based city unless the user has already
 * allowed location access on this site (we never trigger the permission prompt from here).
 */
export function PresenceBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("skycast:presence")) return;
      sessionStorage.setItem("skycast:presence", "1");
    } catch {
      /* ignore */
    }
    const send = (coords?: { lat: number; lon: number }) =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ?? {}),
      }).catch(() => {});

    const permissions = navigator.permissions;
    if (!permissions || !navigator.geolocation) return void send();
    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state !== "granted") return send();
        navigator.geolocation.getCurrentPosition(
          (pos) => send({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => send(),
          { maximumAge: 10 * 60_000, timeout: 8000 },
        );
      })
      .catch(() => send());
  }, []);
  return null;
}
