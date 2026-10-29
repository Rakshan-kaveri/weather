import type { Subscription } from "@prisma/client";
import { APP_NAME, config } from "./config";
import { describe } from "./codes";
import { REPORT_TEXT, STRINGS, aqiWord, compassWord, localDate, type Lang } from "./i18n";
import { getAirQuality, getForecast, hoursFor, type AirQuality, type DayPoint, type Forecast } from "./weather";
import { farmAdvice, type FarmItem } from "./farm";

export type Report = {
  subject: string;
  html: string;
  text: string;
  sms: string;
  forDate: string;
};

type Ctx = { day: DayPoint; forecast: Forecast; aqi: AirQuality | null; sub: Subscription; lang: Lang; farm: FarmItem[] };

/** Weather condition in the report language (English keeps the more precise WMO wording). */
function condition(code: number, lang: Lang) {
  const d = describe(code);
  return lang === "en" ? d.label : REPORT_TEXT[lang].conditions[d.icon];
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

export async function buildReport(sub: Subscription): Promise<Report> {
  const forecast = await getForecast(sub.lat, sub.lon);
  const aqi = sub.includeAqi ? await getAirQuality(sub.lat, sub.lon).catch(() => null) : null;
  const day = forecast.daily[sub.forecastDay === "tomorrow" ? 1 : 0];
  if (!day) throw new Error("Forecast unavailable for this day");
  const lang = (["en", "kn", "hi"].includes(sub.language) ? sub.language : "en") as Lang;
  const ctx: Ctx = { day, forecast, aqi, sub, lang, farm: sub.farmerTips ? farmAdvice(forecast, day) : [] };
  return {
    subject: subjectLine(ctx),
    html: emailHtml(ctx),
    text: emailText(ctx),
    sms: smsText(ctx),
    forDate: day.date,
  };
}

function subjectLine({ day, sub, lang }: Ctx) {
  const t = REPORT_TEXT[lang];
  const when = sub.forecastDay === "tomorrow" ? t.tomorrow : t.today;
  return (
    `${sub.placeName} · ${when}: ${condition(day.weatherCode, lang)}, ${Math.round(day.tempMax)}° / ${Math.round(day.tempMin)}°` +
    (day.precipProbMax >= 40 ? ` · ${t.rainChanceShort} ${day.precipProbMax}%` : "")
  );
}

export function smsText({ day, aqi, sub, lang, farm }: Ctx, withStop = true) {
  const s = STRINGS[lang];
  const t = REPORT_TEXT[lang];
  const when = sub.forecastDay === "tomorrow" ? s.tomorrow : s.today;
  const parts: string[] = [`${APP_NAME} ${sub.placeName} ${when} ${localDate(day.date, lang, "short")}: ${condition(day.weatherCode, lang)}`];
  if (sub.includeTemp) parts.push(`${s.max} ${Math.round(day.tempMax)}°C ${s.min} ${Math.round(day.tempMin)}°C`);
  if (sub.includeRain) parts.push(`${s.rainChance} ${day.precipProbMax}% (${day.precipSum.toFixed(1)} ${t.mm})`);
  if (sub.includeWind) parts.push(`${s.wind} ${Math.round(day.windMax)} ${t.kmh} ${compassWord(day.windDirection, lang)}`);
  if (sub.includeAqi && aqi?.usAqi != null && sub.forecastDay === "today") parts.push(`AQI ${Math.round(aqi.usAqi)} ${aqiWord(aqi.usAqi, lang)}`);
  let msg = parts.join(". ") + ".";
  if (farm.length) {
    const lines = farm.map((i) => t.farmSms(i)).filter((x): x is string => !!x);
    if (lines.length) msg += " " + lines.join(". ") + ".";
  } else if (sub.includeTips) msg += " " + generalTips({ day, lang })[0];
  if (sub.format === "short" && msg.length > 320) msg = msg.slice(0, 317) + "...";
  return withStop ? `${msg} ${s.stop}` : msg;
}

function emailText(ctx: Ctx) {
  const { sub, lang, day } = ctx;
  const t = REPORT_TEXT[lang];
  const dn = (d: string) => localDate(d, lang, "short");
  const farmLines = keyFarmItems(ctx.farm).map((i) => `- ${t.farmTitles[i.key]}: ${t.farm(i, dn)}`).join("\n");
  return [
    subjectLine(ctx),
    localDate(day.date, lang),
    "",
    smsText(ctx, false),
    farmLines ? `\n${t.farmHeading}\n${farmLines}` : "",
    "",
    `${t.fullForecast}: ${config.appUrl}/w?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.placeName)}`,
    `${t.unsubscribe}: ${config.appUrl}/unsubscribe/${sub.unsubscribeToken}`,
  ].join("\n");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FARM_ICON: Record<FarmItem["key"], string> = {
  spray: "#7fd36b", irrigation: "#4ea8ff", soil: "#c9a26b", disease: "#ff9a3c", livestock: "#f5c542",
  harvest: "#e8dd4a", fertilizer: "#41c7b9", sowing: "#7fd36b", heavyRain: "#ff5a5a", wind: "#ff9a3c", outlook: "#8fb8ff",
};

function farmTone(i: FarmItem): string {
  if (i.key === "heavyRain") return "#ff5a5a";
  if (i.key === "disease" && i.risk === "high") return "#ff9a3c";
  if (i.key === "livestock" && i.level === "severe") return "#ff5a5a";
  if (i.key === "spray" && !i.ok) return "#ff9a3c";
  if (i.key === "fertilizer" && i.advice === "avoid") return "#ff9a3c";
  return FARM_ICON[i.key];
}

/** Keep the email short: only items that call for action, most important first. */
function keyFarmItems(farm: FarmItem[]) {
  const keep = farm.filter((i) => {
    switch (i.key) {
      case "soil":
      case "sowing":
        return false;
      case "disease":
        return i.risk !== "low";
      case "livestock":
        return i.level !== "ok";
      case "fertilizer":
        return i.advice !== "irrigate";
      case "harvest":
        return i.good;
      default:
        return true;
    }
  });
  const order: FarmItem["key"][] = ["heavyRain", "spray", "irrigation", "disease", "livestock", "wind", "fertilizer", "harvest", "outlook"];
  return keep.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).slice(0, 6);
}

function emailHtml(ctx: Ctx) {
  const { day, forecast, aqi, sub, lang, farm } = ctx;
  const t = REPORT_TEXT[lang];
  const when = sub.forecastDay === "tomorrow" ? t.tomorrow : t.today;
  const link = `${config.appUrl}/w?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.placeName)}`;
  const unsub = `${config.appUrl}/unsubscribe/${sub.unsubscribeToken}`;
  const manage = `${config.appUrl}/subscriptions`;
  const dn = (d: string) => localDate(d, lang, "short");

  const periods = [
    { label: t.periods[0], from: 6, to: 11 },
    { label: t.periods[1], from: 12, to: 16 },
    { label: t.periods[2], from: 17, to: 20 },
    { label: t.periods[3], from: 21, to: 23 },
  ]
    .map((p) => {
      const hs = hoursFor(forecast, day.date).filter((h) => {
        const hr = Number(h.time.slice(11, 13));
        return hr >= p.from && hr <= p.to;
      });
      if (!hs.length) return null;
      const temp = hs.reduce((a, h) => a + h.temperature, 0) / hs.length;
      const rain = Math.max(...hs.map((h) => h.precipProb));
      const mid = hs[Math.floor(hs.length / 2)];
      return { label: p.label, temp, rain, cond: condition(mid.weatherCode, lang) };
    })
    .filter(Boolean) as { label: string; temp: number; rain: number; cond: string }[];

  const stat = (label: string, value: string) =>
    `<td style="padding:10px 6px;text-align:center;border-right:1px solid #1f2a3d"><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7f8ba3">${esc(label)}</div><div style="font-size:14px;font-weight:600;color:#e8edf6;margin-top:3px">${esc(value)}</div></td>`;

  const stats: string[] = [];
  if (sub.includeTemp) stats.push(stat(t.highLow, `${Math.round(day.tempMax)}° / ${Math.round(day.tempMin)}°`));
  if (sub.includeRain) stats.push(stat(t.rain, `${day.precipProbMax}% · ${day.precipSum.toFixed(1)} ${t.mm}`));
  if (sub.includeWind) stats.push(stat(t.wind, `${Math.round(day.windMax)} ${t.kmh} ${compassWord(day.windDirection, lang)}`));
  if (sub.includeAqi && aqi?.usAqi != null && sub.forecastDay === "today") stats.push(stat(t.airQuality, `${Math.round(aqi.usAqi)} · ${aqiWord(aqi.usAqi, lang)}`));

  const tips = sub.includeTips && !farm.length ? generalTips({ day, lang }).slice(0, 1) : [];
  const detailed = sub.format === "detailed";
  const row = (cells: string) => `<tr><td style="padding:14px 22px 0">${cells}</td></tr>`;

  const items = keyFarmItems(farm);
  const farmHtml = items.length
    ? row(
        `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7fd36b;font-weight:700;margin:4px 0 6px">${esc(t.farmHeading)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
          items
            .map(
              (i) =>
                `<tr><td style="padding:6px 0;border-bottom:1px solid #1a2333;vertical-align:top;width:4px"><div style="width:3px;height:16px;border-radius:2px;background:${farmTone(i)}"></div></td><td style="padding:6px 0 6px 9px;border-bottom:1px solid #1a2333;font-size:12.5px;line-height:1.45;color:#dbe6f7"><b style="color:${farmTone(i)}">${esc(t.farmTitles[i.key])}:</b> ${esc(t.farm(i, dn))}</td></tr>`,
            )
            .join("") +
          `</table>`,
      )
    : "";

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjectLine(ctx))}</title></head>
<body style="margin:0;background:#0a0f1a;font-family:-apple-system,Segoe UI,Roboto,'Noto Sans Kannada','Noto Sans Devanagari',Helvetica,Arial,sans-serif;color:#e8edf6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:20px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#111827;border:1px solid #1f2a3d;border-radius:12px;overflow:hidden">
<tr><td style="padding:14px 22px;border-bottom:1px solid #1f2a3d">
  <span style="font-weight:700;font-size:14px;color:#e8edf6">${APP_NAME}</span>
  <span style="float:right;font-size:12px;color:#7f8ba3">${esc(localDate(day.date, lang))}</span>
</td></tr>
<tr><td style="padding:20px 22px 4px">
  <div style="font-size:12px;color:#7f8ba3;letter-spacing:.04em">${esc(sub.placeName)} · ${esc(when)}</div>
  <div style="font-size:34px;font-weight:300;margin:6px 0 2px;color:#ffffff">${Math.round(day.tempMax)}°<span style="font-size:18px;color:#7f8ba3"> / ${Math.round(day.tempMin)}°</span></div>
  <div style="font-size:15px;color:#cfd7e6">${esc(condition(day.weatherCode, lang))}</div>
</td></tr>
${stats.length ? `<tr><td style="padding:14px 14px 2px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1422;border:1px solid #1f2a3d;border-radius:8px"><tr>${stats.join("")}</tr></table></td></tr>` : ""}
${detailed && periods.length ? row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${periods
    .slice(0, 3)
    .map(
      (p) =>
        `<td style="width:33%;padding:6px 4px;text-align:center;border:1px solid #1a2333;font-size:12px"><div style="color:#7f8ba3;font-size:11px">${esc(p.label)}</div><div style="color:#e8edf6;margin-top:2px">${Math.round(p.temp)}° · ${p.rain}%</div><div style="color:#9aa6bd;font-size:11px">${esc(p.cond)}</div></td>`,
    )
    .join("")}</tr></table>`) : ""}
${detailed ? `<tr><td style="padding:10px 22px 0;font-size:12px;color:#7f8ba3">${esc(t.sunrise)} ${day.sunrise.slice(11, 16)} · ${esc(t.sunset)} ${day.sunset.slice(11, 16)} · ${esc(t.uvMax)} ${Math.round(day.uvMax)}${day.sunshineHours != null ? ` · ${esc(t.sunshine)} ${day.sunshineHours.toFixed(1)} ${esc(t.hours)}` : ""}</td></tr>` : ""}
${tips.length ? row(`<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8fb8ff;font-weight:700;margin:6px 0 8px">${esc(t.tipsHeading)}</div>${tips.map((x) => `<div style="background:#13233b;border-left:3px solid #4ea8ff;padding:8px 11px;border-radius:6px;margin-bottom:7px;font-size:13px;color:#dbe6f7">${esc(x)}</div>`).join("")}`) : ""}
${farmHtml}
<tr><td style="padding:18px 22px 22px"><a href="${link}" style="display:inline-block;background:#4ea8ff;color:#06101f;text-decoration:none;font-weight:600;font-size:13px;padding:9px 16px;border-radius:7px">${esc(t.openForecast)}</a></td></tr>
<tr><td style="padding:14px 22px;border-top:1px solid #1f2a3d;font-size:11px;color:#66728a;line-height:1.6">
  ${esc(t.footer(sub.placeName, sub.sendTime, sub.timezone))}<br>
  <a href="${manage}" style="color:#8fb8ff">${esc(t.manage)}</a> · <a href="${unsub}" style="color:#8fb8ff">${esc(t.unsubscribe)}</a><br>
  ${esc(t.dataCredit)}
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
