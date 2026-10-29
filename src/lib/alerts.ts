import type { AlertRule } from "@prisma/client";
import { prisma } from "./prisma";
import { getAirQuality, getForecast } from "./weather";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { alertHtml } from "./report";
import { config } from "./config";

export const METRICS: Record<string, { label: string; unit: string }> = {
  rain_prob: { label: "Chance of rain", unit: "%" },
  precip_sum: { label: "Total rainfall", unit: "mm" },
  temp_max: { label: "Maximum temperature", unit: "°C" },
  temp_min: { label: "Minimum temperature", unit: "°C" },
  wind_max: { label: "Maximum wind speed", unit: "km/h" },
  aqi: { label: "Air quality index (US AQI)", unit: "" },
};

export async function metricValue(rule: Pick<AlertRule, "lat" | "lon" | "metric" | "day">) {
  const fc = await getForecast(rule.lat, rule.lon);
  const day = fc.daily[rule.day === "today" ? 0 : 1];
  switch (rule.metric) {
    case "rain_prob":
      return { value: day.precipProbMax, date: day.date };
    case "precip_sum":
      return { value: day.precipSum, date: day.date };
    case "temp_max":
      return { value: day.tempMax, date: day.date };
    case "temp_min":
      return { value: day.tempMin, date: day.date };
    case "wind_max":
      return { value: day.windMax, date: day.date };
    case "aqi": {
      const aq = await getAirQuality(rule.lat, rule.lon);
      const vals = aq.hourly.filter((h) => h.time.startsWith(day.date) && h.usAqi != null).map((h) => h.usAqi!);
      return { value: vals.length ? Math.max(...vals) : aq.usAqi ?? 0, date: day.date };
    }
    default:
      throw new Error(`Unknown metric ${rule.metric}`);
  }
}

export function describeRule(rule: Pick<AlertRule, "metric" | "operator" | "threshold" | "day" | "placeName">) {
  const m = METRICS[rule.metric];
  return `${m?.label ?? rule.metric} ${rule.operator === "gt" ? "above" : "below"} ${rule.threshold}${m?.unit ?? ""} ${rule.day} in ${rule.placeName}`;
}

/** Runs hourly from the worker. Each rule fires at most once per forecast day. */
export async function runAlerts() {
  const run = await prisma.jobRun.create({ data: { job: "alerts" } });
  let processed = 0;
  let sent = 0;
  let failed = 0;
  const rules = await prisma.alertRule.findMany({
    where: { active: true, user: { blocked: false } },
    include: { user: true },
  });
  for (const rule of rules) {
    processed++;
    try {
      const { value, date } = await metricValue(rule);
      const hit = rule.operator === "gt" ? value > rule.threshold : value < rule.threshold;
      if (!hit || rule.lastTriggeredFor === date) continue;

      const m = METRICS[rule.metric];
      const title = `${m.label} ${rule.operator === "gt" ? "above" : "below"} ${rule.threshold}${m.unit} ${rule.day} in ${rule.placeName}`;
      const body = `Forecast for ${date}: ${m.label.toLowerCase()} ${Math.round(value * 10) / 10}${m.unit}.`;
      const link = `${config.appUrl}/w?lat=${rule.lat}&lon=${rule.lon}&name=${encodeURIComponent(rule.placeName)}`;

      if (rule.notifyInApp) {
        await prisma.notification.create({ data: { userId: rule.userId, title, body, link } });
      }
      if (rule.notifyEmail && rule.user.email) {
        const d = await prisma.delivery.create({
          data: { alertRuleId: rule.id, userId: rule.userId, channel: "EMAIL", to: rule.user.email, kind: `alert:${rule.id}:${date}`, forDate: date, subject: title, preview: body, attempts: 1 },
        });
        try {
          const r = await sendEmail({ to: rule.user.email, subject: `Weather alert: ${title}`, html: alertHtml(title, body, link), text: `${title}\n${body}\n${link}` });
          await prisma.delivery.update({ where: { id: d.id }, data: { status: r.provider === "console" ? "DELIVERED" : "SENT", providerId: r.id, sentAt: new Date() } });
          sent++;
        } catch (e) {
          await prisma.delivery.update({ where: { id: d.id }, data: { status: "FAILED", error: String(e).slice(0, 1000) } });
          failed++;
        }
      }
      if (rule.notifySms && rule.user.phone) {
        const d = await prisma.delivery.create({
          data: { alertRuleId: rule.id, userId: rule.userId, channel: "SMS", to: rule.user.phone, kind: `alert-sms:${rule.id}:${date}`, forDate: date, preview: body, attempts: 1 },
        });
        try {
          const r = await sendSms(rule.user.phone, `SkyCast alert: ${title}. ${body}`);
          await prisma.delivery.update({ where: { id: d.id }, data: { status: r.provider === "console" ? "DELIVERED" : "SENT", providerId: r.id, sentAt: new Date() } });
          sent++;
        } catch (e) {
          await prisma.delivery.update({ where: { id: d.id }, data: { status: "FAILED", error: String(e).slice(0, 1000) } });
          failed++;
        }
      }
      await prisma.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredFor: date, lastTriggeredAt: new Date() } });
    } catch (err) {
      failed++;
      console.error("[alerts]", rule.id, err);
    }
  }
  await prisma.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), processed, sent, failed } });
  return { processed, sent, failed };
}
