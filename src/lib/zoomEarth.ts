import { cached } from "./cache";

export const ZOOM_EARTH_URL = "https://zoom.earth/";

/**
 * Embedding Zoom Earth is OFF by default. Their terms of service don't address framing, so permission
 * is unconfirmed. Set ZOOM_EARTH_EMBED=true only after Zoom Earth (support@zoom.earth) confirms it's OK.
 */
export function zoomEarthEmbedEnabled() {
  return process.env.ZOOM_EARTH_EMBED === "true";
}

export type EmbedCheck = {
  status: "allowed" | "blocked" | "unknown";
  reason: string;
  checkedAt: string;
};

/**
 * Reads Zoom Earth's own response headers (one request, cached for an hour) to see whether the site
 * tells browsers it may not be framed. Nothing is downloaded, proxied or rehosted, and the decision is
 * left to the browser: if the headers forbid framing we simply don't render the iframe.
 */
export async function checkZoomEarthEmbeddable(): Promise<EmbedCheck> {
  return cached("zoom-earth:embed-check", 3600, async () => {
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(ZOOM_EARTH_URL, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "SkyCast student demo (embed header check)" },
        signal: AbortSignal.timeout(8000),
      });
      const xfo = res.headers.get("x-frame-options")?.toLowerCase() ?? "";
      const csp = res.headers.get("content-security-policy")?.toLowerCase() ?? "";
      const fa = /frame-ancestors([^;]*)/.exec(csp)?.[1]?.trim() ?? "";

      if (xfo.includes("deny") || xfo.includes("sameorigin")) {
        return { status: "blocked", reason: `Zoom Earth sends "X-Frame-Options: ${xfo.toUpperCase()}", so browsers refuse to show it inside other websites.`, checkedAt };
      }
      if (fa && !/(^|\s)\*(\s|$)/.test(fa)) {
        return { status: "blocked", reason: `Zoom Earth's Content-Security-Policy only allows framing by: ${fa}.`, checkedAt };
      }
      if (!res.ok) return { status: "unknown", reason: `Zoom Earth answered with HTTP ${res.status}.`, checkedAt };
      return { status: "allowed", reason: "No X-Frame-Options or frame-ancestors restriction was found in Zoom Earth's response headers.", checkedAt };
    } catch {
      return { status: "unknown", reason: "Couldn't reach zoom.earth from the server to check its framing rules.", checkedAt };
    }
  });
}
