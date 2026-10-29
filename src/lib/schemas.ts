import { z } from "zod";
import { isValidTimeZone } from "./time";

export const placeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  region: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const subscriptionSchema = z.object({
  channel: z.enum(["EMAIL", "SMS"]),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  contactName: z.string().max(80).optional().nullable(),
  placeName: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  sendTime: hhmm,
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  forecastDay: z.enum(["today", "tomorrow"]),
  format: z.enum(["short", "detailed"]),
  language: z.enum(["en", "kn", "hi"]),
  includeTemp: z.boolean(),
  includeRain: z.boolean(),
  includeWind: z.boolean(),
  includeAqi: z.boolean(),
  includeTips: z.boolean(),
  farmerTips: z.boolean(),
  severeAlerts: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const alertSchema = z.object({
  placeName: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone").optional(),
  metric: z.enum(["rain_prob", "precip_sum", "temp_max", "temp_min", "wind_max", "aqi"]),
  operator: z.enum(["gt", "lt"]),
  threshold: z.number().min(-60).max(1000),
  day: z.enum(["today", "tomorrow"]),
  notifyEmail: z.boolean(),
  notifyInApp: z.boolean(),
  notifySms: z.boolean(),
  active: z.boolean().optional(),
});

export const settingsSchema = z.object({
  tempUnit: z.enum(["C", "F"]).optional(),
  windUnit: z.enum(["kmh", "ms", "mph", "kn"]).optional(),
  timeFormat: z.enum(["12", "24"]).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  severeInApp: z.boolean().optional(),
  severeEmail: z.boolean().optional(),
  severeSms: z.boolean().optional(),
  phone: z.string().max(20).optional().nullable(),
  name: z.string().trim().min(1).max(80).optional(),
});
