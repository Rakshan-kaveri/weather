import { cached } from "./cache";
import { config } from "./config";

export type PlaceName = { name: string; region?: string; country?: string; countryCode?: string };

/** Reverse geocoding via OpenStreetMap Nominatim (cached, low volume, with contact UA as their policy asks). */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceName> {
  const la = Math.round(lat * 100) / 100;
  const lo = Math.round(lon * 100) / 100;
  return cached(`rev:${la}:${lo}`, 7 * 86400, async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${la}&lon=${lo}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": `SkyCast/1.0 (${config.contactEmail})`,
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(String(res.status));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await res.json();
      const a = j.address ?? {};
      const name =
        a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state || j.name || "Unknown place";
      return { name, region: a.state, country: a.country, countryCode: a.country_code?.toUpperCase() };
    } catch {
      return { name: `${la.toFixed(2)}, ${lo.toFixed(2)}` };
    }
  });
}

export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip");
}

export type IpLocation = { city?: string; region?: string; country?: string; lat?: number; lon?: number };

/**
 * Approximate location of a request.
 * Uses Cloudflare's visitor-location headers when present (enable "Add visitor location headers"
 * in Cloudflare → Rules → Managed Transforms), otherwise falls back to the free ipwho.is lookup.
 */
export async function ipLocation(headers: Headers): Promise<IpLocation> {
  const city = headers.get("cf-ipcity") ?? undefined;
  const country = headers.get("cf-ipcountry") ?? undefined;
  const lat = headers.get("cf-iplatitude");
  const lon = headers.get("cf-iplongitude");
  const region = headers.get("cf-region") ?? undefined;
  if (city) {
    return {
      city: decodeURIComponentSafe(city),
      region: region ? decodeURIComponentSafe(region) : undefined,
      country,
      lat: lat ? Number(lat) : undefined,
      lon: lon ? Number(lon) : undefined,
    };
  }
  const ip = clientIp(headers);
  if (!ip || isPrivateIp(ip)) return { country };
  return cached(`ip:${ip}`, 86400, async () => {
    try {
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,latitude,longitude`, {
        signal: AbortSignal.timeout(5000),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await res.json();
      if (!j.success) return { country };
      return { city: j.city, region: j.region, country: j.country, lat: j.latitude, lon: j.longitude };
    } catch {
      return { country };
    }
  });
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isPrivateIp(ip: string) {
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}
