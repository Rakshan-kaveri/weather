import type { Subscription } from "@prisma/client";
import { APP_NAME, config } from "./config";
import { aqiLevel, compass, describe, type IconKind } from "./codes";
import { STRINGS, type Lang } from "./i18n";
import { getAirQuality, getForecast, hoursFor, type AirQuality, type DayPoint, type Forecast } from "./weather";
import { dateLabel, dayName } from "./units";

export type Report = {
  subject: string;
  html: string;
  text: string;
  sms: string;
  forDate: string;
};

type Ctx = { day: DayPoint; forecast: Forecast; aqi: AirQuality | null; sub: Subscription; lang: Lang };

function conditionWord(icon: IconKind, lang: Lang) {
  const s = STRINGS[lang];
  if (icon === "storm") return s.stormy;
  if (icon === "rain" || icon === "heavy-rain" || icon === "drizzle") return s.rainy;
  if (icon === "fog") return s.foggy;
  if (icon === "cloudy") return s.cloudy;
  return s.sunny;
}

export function generalTips({ day, lang }: Pick<Ctx, "day" | "lang">) {
  const s = STRINGS[lang];
  const tips: string[] = [];
  if (day.precipProbMax >= 50 || day.precipSum >= 2) tips.push(s.tipUmbrella);
  if (day.tempMax >= 37) tips.push(s.tipHeat);
  if (day.tempMin <= 10) tips.push(s.tipCold);
  if (day.uvMax >= 8 && day.precipProbMax < 50) tips.push(s.tipUv);
  if (!tips.length) tips.push(s.tipNice);
  return tips;
}

/** Simple agronomy rules of thumb for farmers. */
export function farmerTips({ day, forecast, lang }: Pick<Ctx, "day" | "forecast" | "lang">) {
  const s = STRINGS[lang];
  const hours = hoursFor(forecast, day.date).filter((h) => {
    const hr = Number(h.time.slice(11, 13));
    return hr >= 6 && hr <= 18;
  });
  const maxWindDay = Math.max(...hours.map((h) => h.windSpeed), 0);
  const maxRainProbDay = Math.max(...hours.map((h) => h.precipProb), 0);
  const tips: string[] = [];
  if (day.precipSum >= 20) tips.push(s.farmHeavyRain);
  if (maxWindDay < 15 && maxRainProbDay < 30) tips.push(s.farmSpray);
  else tips.push(s.farmNoSpray);
  if (day.precipSum >= 5 || day.precipProbMax >= 60) tips.push(s.farmSkipIrrigation);
  else if (day.tempMax >= 32) tips.push(s.farmIrrigate);
  if (day.tempMax >= 38) tips.push(s.farmHeatLivestock);
  return tips;
}

export async function buildReport(sub: Subscription): Promise<Report> {
  const forecast = await getForecast(sub.lat, sub.lon);
  const aqi = sub.includeAqi ? await getAirQuality(sub.lat, sub.lon).catch(() => null) : null;
  const day = forecast.daily[sub.forecastDay === "tomorrow" ? 1 : 0];
  if (!day) throw new Error("Forecast unavailable for this day");
  const lang = (["en", "kn", "hi"].includes(sub.language) ? sub.language : "en") as Lang;
  const ctx: Ctx = { day, forecast, aqi, sub, lang };
  return {
    subject: subjectLine(ctx),
    html: emailHtml(ctx),
    text: emailText(ctx),
    sms: smsText(ctx),
    forDate: day.date,
  };
}

function subjectLine({ day, sub }: Ctx) {
  const d = describe(day.weatherCode);
  const when = sub.forecastDay === "tomorrow" ? "Tomorrow" : "Today";
  return `${when} in ${sub.placeName}: ${d.label}, ${Math.round(day.tempMax)}° / ${Math.round(day.tempMin)}°` +
    (day.precipProbMax >= 40 ? ` · ${day.precipProbMax}% rain` : "");
}

export function smsText({ day, forecast, aqi, sub, lang }: Ctx, withStop = true) {
  const s = STRINGS[lang];
  const when = sub.forecastDay === "tomorrow" ? s.tomorrow : s.today;
  const d = describe(day.weatherCode);
  const parts: string[] = [`${APP_NAME} ${sub.placeName} ${when} ${dateLabel(day.date)}: ${conditionWord(d.icon, lang)}`];
  if (sub.includeTemp) parts.push(`${s.max} ${Math.round(day.tempMax)}°C ${s.min} ${Math.round(day.tempMin)}°C`);
  if (sub.includeRain) parts.push(`${s.rainChance} ${day.precipProbMax}% (${day.precipSum.toFixed(1)}mm)`);
  if (sub.includeWind) parts.push(`${s.wind} ${Math.round(day.windMax)} km/h ${compass(day.windDirection)}`);
  if (sub.includeAqi && aqi?.usAqi != null && sub.forecastDay === "today") parts.push(`AQI ${Math.round(aqi.usAqi)}`);
  let msg = parts.join(". ") + ".";
  if (sub.farmerTips) msg += " " + farmerTips({ day, forecast, lang }).join(" ");
  else if (sub.includeTips) msg += " " + generalTips({ day, lang })[0];
  if (sub.format === "short" && msg.length > 300) msg = msg.slice(0, 297) + "...";
  return withStop ? `${msg} ${s.stop}` : msg;
}

function emailText(ctx: Ctx) {
  const { sub } = ctx;
  return `${smsText(ctx, false)}\n\nFull forecast: ${config.appUrl}/w?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.placeName)}\nUnsubscribe: ${config.appUrl}/unsubscribe/${sub.unsubscribeToken}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function emailHtml({ day, forecast, aqi, sub, lang }: Ctx) {
  const d = describe(day.weatherCode);
  const s = STRINGS[lang];
  const when = sub.forecastDay === "tomorrow" ? s.tomorrow : s.today;
  const link = `${config.appUrl}/w?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.placeName)}`;
  const unsub = `${config.appUrl}/unsubscribe/${sub.unsubscribeToken}`;
  const manage = `${config.appUrl}/subscriptions`;

  const periods = [
    { label: "Morning", from: 6, to: 11 },
    { label: "Afternoon", from: 12, to: 16 },
    { label: "Evening", from: 17, to: 20 },
    { label: "Night", from: 21, to: 23 },
  ].map((p) => {
    const hs = hoursFor(forecast, day.date).filter((h) => {
      const hr = Number(h.time.slice(11, 13));
      return hr >= p.from && hr <= p.to;
    });
    if (!hs.length) return null;
    const t = hs.reduce((a, h) => a + h.temperature, 0) / hs.length;
    const rain = Math.max(...hs.map((h) => h.precipProb));
    const mid = hs[Math.floor(hs.length / 2)];
    return { ...p, t, rain, label2: describe(mid.weatherCode).label };
  }).filter(Boolean) as { label: string; t: number; rain: number; label2: string }[];

  const stat = (label: string, value: string) =>
    `<td style="padding:12px 8px;text-align:center;border-right:1px solid #1f2a3d"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7f8ba3">${esc(label)}</div><div style="font-size:17px;font-weight:600;color:#e8edf6;margin-top:4px">${esc(value)}</div></td>`;

  const stats: string[] = [];
  if (sub.includeTemp) stats.push(stat("High / Low", `${Math.round(day.tempMax)}° / ${Math.round(day.tempMin)}°`));
  if (sub.includeRain) stats.push(stat("Rain", `${day.precipProbMax}% · ${day.precipSum.toFixed(1)} mm`));
  if (sub.includeWind) stats.push(stat("Wind", `${Math.round(day.windMax)} km/h ${compass(day.windDirection)}`));
  if (sub.includeAqi && aqi?.usAqi != null && sub.forecastDay === "today") stats.push(stat("Air quality", `${Math.round(aqi.usAqi)} · ${aqiLevel(aqi.usAqi).label}`));

  const tips = [
    ...(sub.includeTips ? generalTips({ day, lang }) : []),
    ...(sub.farmerTips ? farmerTips({ day, forecast, lang }) : []),
  ];

  const detailed = sub.format === "detailed";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjectLine({ day, forecast, aqi, sub, lang }))}</title></head>
<body style="margin:0;background:#0a0f1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8edf6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2a3d;border-radius:14px;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:1px solid #1f2a3d">
  <span style="font-weight:700;font-size:16px;letter-spacing:.02em;color:#e8edf6">${APP_NAME}</span>
  <span style="float:right;font-size:12px;color:#7f8ba3">${esc(dayName(day.date, false))}, ${esc(dateLabel(day.date))}</span>
</td></tr>
<tr><td style="padding:28px 24px 8px">
  <div style="font-size:13px;color:#7f8ba3;text-transform:uppercase;letter-spacing:.08em">${esc(when)} · ${esc(sub.placeName)}</div>
  <div style="font-size:44px;font-weight:300;margin:8px 0 2px;color:#ffffff">${Math.round(day.tempMax)}°<span style="font-size:22px;color:#7f8ba3"> / ${Math.round(day.tempMin)}°</span></div>
  <div style="font-size:18px;color:#cfd7e6">${esc(d.label)}</div>
</td></tr>
${stats.length ? `<tr><td style="padding:16px 16px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1422;border:1px solid #1f2a3d;border-radius:10px"><tr>${stats.join("")}</tr></table></td></tr>` : ""}
${detailed && periods.length ? `<tr><td style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${periods
    .map(
      (p) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #1a2333;color:#7f8ba3;font-size:13px;width:30%">${p.label}</td><td style="padding:8px 0;border-bottom:1px solid #1a2333;font-size:14px">${esc(p.label2)}</td><td style="padding:8px 0;border-bottom:1px solid #1a2333;text-align:right;font-size:14px">${Math.round(p.t)}° · ${p.rain}%</td></tr>`,
    )
    .join("")}</table></td></tr>` : ""}
${detailed ? `<tr><td style="padding:12px 24px 0;font-size:13px;color:#7f8ba3">Sunrise ${day.sunrise.slice(11, 16)} · Sunset ${day.sunset.slice(11, 16)} · UV max ${Math.round(day.uvMax)}</td></tr>` : ""}
${tips.length ? `<tr><td style="padding:18px 24px 0">${tips.map((t) => `<div style="background:#13233b;border-left:3px solid #4ea8ff;padding:10px 12px;border-radius:6px;margin-bottom:8px;font-size:14px;color:#dbe6f7">${esc(t)}</div>`).join("")}</td></tr>` : ""}
<tr><td style="padding:22px 24px 26px"><a href="${link}" style="display:inline-block;background:#4ea8ff;color:#06101f;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Open full forecast</a></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #1f2a3d;font-size:12px;color:#66728a;line-height:1.6">
  You're receiving this because you subscribed to daily weather for ${esc(sub.placeName)} at ${esc(sub.sendTime)} (${esc(sub.timezone)}).<br>
  <a href="${manage}" style="color:#8fb8ff">Manage reports</a> · <a href="${unsub}" style="color:#8fb8ff">Unsubscribe</a><br>
  Weather data: Open-Meteo.com
</td></tr>
</table></td></tr></table></body></html>`;
}

/** Plain alert message (used by alert rules). */
export function alertHtml(title: string, body: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0f1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8edf6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2a3d;border-radius:14px">
<tr><td style="padding:18px 24px;border-bottom:1px solid #1f2a3d;font-weight:700">${APP_NAME} · Weather alert</td></tr>
<tr><td style="padding:24px"><div style="font-size:20px;font-weight:600;color:#ffcf5a">${esc(title)}</div><p style="font-size:15px;line-height:1.6;color:#cfd7e6">${esc(body)}</p>
<a href="${link}" style="display:inline-block;background:#4ea8ff;color:#06101f;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">View forecast</a></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #1f2a3d;font-size:12px;color:#66728a">Manage alerts at <a href="${config.appUrl}/alerts" style="color:#8fb8ff">${config.appUrl.replace(/^https?:\/\//, "")}/alerts</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Email for automatic severe-weather warnings. */
export function severeHtml(w: { title: string; message: string; level: string; startsAt?: string; date: string; link?: string }, place: string, link: string) {
  const color = w.level === "severe" ? "#ff5a5a" : w.level === "warning" ? "#ff9a3c" : "#f5c542";
  const label = w.level === "severe" ? "SEVERE WARNING" : w.level === "warning" ? "WARNING" : "WATCH";
  return `<!doctype html><html><body style="margin:0;background:#0a0f1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8edf6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2a3d;border-top:4px solid ${color};border-radius:14px">
<tr><td style="padding:18px 24px;border-bottom:1px solid #1f2a3d;font-weight:700">${APP_NAME} <span style="float:right;color:${color};font-size:12px;letter-spacing:.1em">${label}</span></td></tr>
<tr><td style="padding:24px">
<div style="font-size:13px;color:#7f8ba3;text-transform:uppercase;letter-spacing:.08em">${esc(place)}</div>
<div style="font-size:22px;font-weight:700;color:${color};margin-top:6px">${esc(w.title)}</div>
${w.startsAt ? `<div style="font-size:14px;color:#cfd7e6;margin-top:6px">From ${esc(w.startsAt.replace("T", " "))} local time</div>` : ""}
<p style="font-size:15px;line-height:1.6;color:#dbe6f7">${esc(w.message)}</p>
<a href="${link}" style="display:inline-block;background:#4ea8ff;color:#06101f;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Open forecast</a>
${w.link ? ` <a href="${w.link}" style="display:inline-block;margin-left:8px;color:#8fb8ff;font-size:14px">Cyclone report (GDACS)</a>` : ""}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #1f2a3d;font-size:12px;color:#66728a;line-height:1.6">Automatic warning for a place saved in your account. Always follow official IMD and local authority advisories.<br>Turn these off in <a href="${config.appUrl}/settings" style="color:#8fb8ff">Settings</a>.</td></tr>
</table></td></tr></table></body></html>`;
}
