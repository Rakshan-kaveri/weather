import { z } from "zod";
import { apiUser, body, handler, json, limit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { clientIp, ipLocation, reverseGeocode } from "@/lib/geo";

const schema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

/**
 * POST /api/presence — called once per browser session after sign-in.
 * Records the approximate sign-in location (city from IP, or the browser location if the user allowed it).
 */
export const POST = handler(async (req: Request) => {
  limit(req, "presence", 10);
  const user = await apiUser();
  const { lat, lon } = await body(req, schema);
  const ip = clientIp(req.headers);
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  let loc: { city?: string; region?: string; country?: string; lat?: number; lon?: number; source: string };
  if (lat != null && lon != null) {
    const name = await reverseGeocode(lat, lon);
    loc = { city: name.name, region: name.region, country: name.country, lat, lon, source: "gps" };
  } else {
    loc = { ...(await ipLocation(req.headers)), source: "ip" };
  }

  // One login event per 30 minutes is plenty; GPS updates always refine the latest one.
  const recent = await prisma.loginEvent.findFirst({
    where: { userId: user.id, at: { gt: new Date(Date.now() - 30 * 60_000) } },
    orderBy: { at: "desc" },
  });
  const data = {
    ip,
    city: loc.city ?? null,
    region: loc.region ?? null,
    country: loc.country ?? null,
    lat: loc.lat ?? null,
    lon: loc.lon ?? null,
    source: loc.source,
    userAgent: ua,
  };
  if (recent && (loc.source === "gps" || recent.source === "ip")) {
    await prisma.loginEvent.update({ where: { id: recent.id }, data });
  } else if (!recent) {
    await prisma.loginEvent.create({ data: { userId: user.id, ...data } });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenAt: new Date(),
      lastIp: ip,
      ...(loc.city || loc.country
        ? {
            lastCity: loc.city ?? null,
            lastRegion: loc.region ?? null,
            lastCountry: loc.country ?? null,
            lastLat: loc.lat ?? null,
            lastLon: loc.lon ?? null,
            lastLocationSrc: loc.source,
          }
        : {}),
    },
  });
  return json({ ok: true });
});
