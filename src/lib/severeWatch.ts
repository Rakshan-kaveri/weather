import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { activeCyclones, assessForecast, cycloneWarnings, LEVEL_RANK, type Warning } from "./severe";
import { getForecast } from "./weather";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { severeHtml } from "./report";
import { SEVERE_SMS, type Lang } from "./i18n";
import { config } from "./config";

type Target = {
  key: string; // recipient id for dedupe
  userId: string | null;
  subscriptionId: string | null;
  placeName: string;
  lat: number;
  lon: number;
  email: string | null;
  phone: string | null;
  inApp: boolean;
  lang: Lang;
};

const placeKey = (lat: number, lon: number) => `${lat.toFixed(1)},${lon.toFixed(1)}`;

/** Everyone who should hear about severe weather, and where. */
async function targets(): Promise<Target[]> {
  const list: Target[] = [];
  const seen = new Set<string>();
  const add = (t: Target) => {
    const k = `${t.key}|${placeKey(t.lat, t.lon)}`;
    if (seen.has(k)) return;
    seen.add(k);
    list.push(t);
  };

  const users = await prisma.user.findMany({
    where: { blocked: false, OR: [{ severeInApp: true }, { severeEmail: true }, { severeSms: true }] },
    include: { places: true, subscriptions: { where: { active: true, severeAlerts: true } } },
  });
  for (const u of users) {
    const spots = [
      ...u.places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon })),
      ...u.subscriptions.map((s) => ({ name: s.placeName, lat: s.lat, lon: s.lon })),
    ];
    for (const p of spots) {
      add({
        key: `u:${u.id}`,
        userId: u.id,
        subscriptionId: null,
        placeName: p.name,
        lat: p.lat,
        lon: p.lon,
        email: u.severeEmail ? u.email : null,
        phone: u.severeSms ? u.phone : null,
        inApp: u.severeInApp,
        lang: "en",
      });
    }
  }

  // SMS-only subscribers registered by an admin (e.g. farmers without an account)
  const smsOnly = await prisma.subscription.findMany({ where: { userId: null, active: true, severeAlerts: true, channel: "SMS" } });
  for (const s of smsOnly) {
    add({
      key: `s:${s.id}`,
      userId: null,
      subscriptionId: s.id,
      placeName: s.placeName,
      lat: s.lat,
      lon: s.lon,
      email: null,
      phone: s.phone,
      inApp: false,
      lang: (["en", "kn", "hi"].includes(s.language) ? s.language : "en") as Lang,
    });
  }
  return list;
}

function smsFor(w: Warning, place: string, lang: Lang) {
  const t = SEVERE_SMS[lang];
  const when = w.startsAt ? ` ${w.startsAt.slice(8, 10)}/${w.startsAt.slice(5, 7)} ${w.startsAt.slice(11, 16)}` : ` ${w.date.slice(8, 10)}/${w.date.slice(5, 7)}`;
  if (lang === "en") return `SkyCast ${t.prefix} - ${place}: ${w.title}.${when ? ` From${when}.` : ""} ${w.message.split(". ")[0]}. ${t.safety}`;
  return `SkyCast ${t.prefix} - ${place}: ${t[w.type]}.${when} ${t.safety}`;
}

/** Runs every 30 minutes from the worker. */
export async function runSevereWatch() {
  const run = await prisma.jobRun.create({ data: { job: "severe-weather" } });
  let processed = 0;
  let sent = 0;
  let failed = 0;
  try {
    const all = await targets();
    const cyclones = await activeCyclones().catch(() => []);
    const cache = new Map<string, Warning[]>();

    for (const t of all) {
      const pk = placeKey(t.lat, t.lon);
      if (!cache.has(pk)) {
        try {
          const fc = await getForecast(t.lat, t.lon);
          cache.set(pk, [...(await cycloneWarnings(t.lat, t.lon, cyclones, fc.current.time.slice(0, 10))), ...assessForecast(fc)]);
        } catch {
          cache.set(pk, []);
        }
      }
      // Only "warning" and "severe" are sent; "watch" (e.g. a cyclone 300–500 km away) stays a banner on the site.
      const warnings = (cache.get(pk) ?? []).filter((w) => LEVEL_RANK[w.level] >= LEVEL_RANK.warning);
      for (const w of warnings) {
        processed++;
        const key = `${t.key}:${pk}:${w.type}:${w.level}:${w.date}`;
        try {
          await prisma.severeNotice.create({
            data: {
              key,
              userId: t.userId,
              subscriptionId: t.subscriptionId,
              placeName: t.placeName,
              lat: t.lat,
              lon: t.lon,
              type: w.type,
              level: w.level,
              title: `${w.title} — ${t.placeName}`,
              message: w.message,
              startsAt: w.startsAt ?? null,
              channels: [],
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue; // already warned
          throw err;
        }

        const channels: string[] = [];
        const link = `${config.appUrl}/w?lat=${t.lat}&lon=${t.lon}&name=${encodeURIComponent(t.placeName)}`;
        const title = `${w.title} — ${t.placeName}`;

        if (t.inApp && t.userId) {
          await prisma.notification.create({ data: { userId: t.userId, title, body: w.message, link } });
          channels.push("app");
        }
        if (t.email) {
          const d = await prisma.delivery.create({
            data: { userId: t.userId, channel: "EMAIL", to: t.email, kind: `severe:${key}`, forDate: w.date, subject: title, preview: w.message, attempts: 1 },
          });
          try {
            const r = await sendEmail({ to: t.email, subject: `Weather warning: ${title}`, html: severeHtml(w, t.placeName, link), text: `${title}\n\n${w.message}\n\n${link}` });
            await prisma.delivery.update({ where: { id: d.id }, data: { status: r.provider === "console" ? "DELIVERED" : "SENT", providerId: r.id, sentAt: new Date() } });
            channels.push("email");
            sent++;
          } catch (e) {
            await prisma.delivery.update({ where: { id: d.id }, data: { status: "FAILED", error: String(e).slice(0, 1000) } });
            failed++;
          }
        }
        if (t.phone) {
          const text = smsFor(w, t.placeName, t.lang);
          const d = await prisma.delivery.create({
            data: { userId: t.userId, subscriptionId: null, channel: "SMS", to: t.phone, kind: `severe-sms:${key}`, forDate: w.date, preview: text, attempts: 1 },
          });
          try {
            const r = await sendSms(t.phone, text);
            await prisma.delivery.update({ where: { id: d.id }, data: { status: r.provider === "console" ? "DELIVERED" : "SENT", providerId: r.id, sentAt: new Date() } });
            channels.push("sms");
            sent++;
          } catch (e) {
            await prisma.delivery.update({ where: { id: d.id }, data: { status: "FAILED", error: String(e).slice(0, 1000) } });
            failed++;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
        await prisma.severeNotice.update({ where: { key }, data: { channels } });
      }
    }
    await prisma.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), processed, sent, failed } });
  } catch (err) {
    await prisma.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), processed, sent, failed, ok: false, message: String(err).slice(0, 1000) } });
    throw err;
  }
  return { processed, sent, failed };
}
