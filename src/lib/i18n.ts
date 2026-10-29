import type { IconKind } from "./codes";
import type { FarmItem } from "./farm";
/**
 * Short strings for SMS and email reports in English, Kannada and Hindi,
 * so farmers and rural users can read their report in their own language.
 */
export type Lang = "en" | "kn" | "hi";

type Strings = {
  today: string;
  tomorrow: string;
  max: string;
  min: string;
  rain: string;
  rainChance: string;
  wind: string;
  air: string;
  sunny: string;
  cloudy: string;
  rainy: string;
  stormy: string;
  foggy: string;
  tipUmbrella: string;
  tipHeat: string;
  tipCold: string;
  tipUv: string;
  tipNice: string;
  farmSpray: string;
  farmNoSpray: string;
  farmIrrigate: string;
  farmSkipIrrigation: string;
  farmHeavyRain: string;
  farmHeatLivestock: string;
  stop: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    max: "Max",
    min: "Min",
    rain: "Rain",
    rainChance: "Rain chance",
    wind: "Wind",
    air: "Air",
    sunny: "Clear",
    cloudy: "Cloudy",
    rainy: "Rain",
    stormy: "Thunderstorm",
    foggy: "Fog",
    tipUmbrella: "Carry an umbrella.",
    tipHeat: "Very hot — drink water and avoid the afternoon sun.",
    tipCold: "Cold — wear warm clothes.",
    tipUv: "Strong sun — use sunscreen.",
    tipNice: "Pleasant weather expected.",
    farmSpray: "Good day for spraying (low wind, no rain).",
    farmNoSpray: "Avoid spraying — wind or rain expected.",
    farmIrrigate: "Dry and hot — plan irrigation.",
    farmSkipIrrigation: "Rain expected — you can skip irrigation.",
    farmHeavyRain: "Heavy rain — postpone harvest and fertiliser.",
    farmHeatLivestock: "Heat stress — give livestock shade and water.",
    stop: "Reply STOP to unsubscribe",
  },
  kn: {
    today: "ಇಂದು",
    tomorrow: "ನಾಳೆ",
    max: "ಗರಿಷ್ಠ",
    min: "ಕನಿಷ್ಠ",
    rain: "ಮಳೆ",
    rainChance: "ಮಳೆ ಸಾಧ್ಯತೆ",
    wind: "ಗಾಳಿ",
    air: "ಗಾಳಿಯ ಗುಣಮಟ್ಟ",
    sunny: "ಬಿಸಿಲು",
    cloudy: "ಮೋಡ",
    rainy: "ಮಳೆ",
    stormy: "ಗುಡುಗು ಸಹಿತ ಮಳೆ",
    foggy: "ಮಂಜು",
    tipUmbrella: "ಕೊಡೆ ತೆಗೆದುಕೊಂಡು ಹೋಗಿ.",
    tipHeat: "ತುಂಬಾ ಬಿಸಿ — ನೀರು ಕುಡಿಯಿರಿ, ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲು ತಪ್ಪಿಸಿ.",
    tipCold: "ಚಳಿ — ಬೆಚ್ಚಗಿನ ಬಟ್ಟೆ ಧರಿಸಿ.",
    tipUv: "ಬಿಸಿಲು ಹೆಚ್ಚು — ಎಚ್ಚರಿಕೆ ವಹಿಸಿ.",
    tipNice: "ಹಿತವಾದ ಹವಾಮಾನ.",
    farmSpray: "ಔಷಧಿ ಸಿಂಪಡಣೆಗೆ ಸೂಕ್ತ ದಿನ.",
    farmNoSpray: "ಸಿಂಪಡಣೆ ಬೇಡ — ಗಾಳಿ ಅಥವಾ ಮಳೆ ಸಾಧ್ಯತೆ.",
    farmIrrigate: "ಒಣ ಹವಾಮಾನ — ನೀರಾವರಿ ಮಾಡಿ.",
    farmSkipIrrigation: "ಮಳೆ ನಿರೀಕ್ಷೆ — ನೀರಾವರಿ ಬೇಡ.",
    farmHeavyRain: "ಭಾರೀ ಮಳೆ — ಕೊಯ್ಲು ಮತ್ತು ಗೊಬ್ಬರ ಮುಂದೂಡಿ.",
    farmHeatLivestock: "ಬಿಸಿಲು ಹೆಚ್ಚು — ಜಾನುವಾರುಗಳಿಗೆ ನೆರಳು, ನೀರು ಕೊಡಿ.",
    stop: "ನಿಲ್ಲಿಸಲು STOP ಎಂದು ಉತ್ತರಿಸಿ",
  },
  hi: {
    today: "आज",
    tomorrow: "कल",
    max: "अधिकतम",
    min: "न्यूनतम",
    rain: "बारिश",
    rainChance: "बारिश की संभावना",
    wind: "हवा",
    air: "हवा की गुणवत्ता",
    sunny: "साफ़ मौसम",
    cloudy: "बादल",
    rainy: "बारिश",
    stormy: "आंधी-तूफ़ान",
    foggy: "कोहरा",
    tipUmbrella: "छाता साथ रखें।",
    tipHeat: "बहुत गर्मी — पानी पिएं, दोपहर की धूप से बचें।",
    tipCold: "ठंड — गर्म कपड़े पहनें।",
    tipUv: "तेज़ धूप — सावधान रहें।",
    tipNice: "मौसम सुहावना रहेगा।",
    farmSpray: "छिड़काव के लिए अच्छा दिन।",
    farmNoSpray: "छिड़काव न करें — हवा या बारिश की संभावना।",
    farmIrrigate: "सूखा मौसम — सिंचाई करें।",
    farmSkipIrrigation: "बारिश की संभावना — सिंचाई न करें।",
    farmHeavyRain: "भारी बारिश — कटाई और खाद टालें।",
    farmHeatLivestock: "लू — पशुओं को छाया और पानी दें।",
    stop: "बंद करने के लिए STOP लिखें",
  },
};

export const LANG_NAMES: Record<Lang, string> = { en: "English", kn: "ಕನ್ನಡ (Kannada)", hi: "हिन्दी (Hindi)" };

/** Short SMS wording for severe-weather warnings. */
export const SEVERE_SMS: Record<Lang, Record<"thunderstorm" | "heavy_rain" | "downpour" | "strong_wind" | "cyclone" | "prefix" | "safety", string>> = {
  en: {
    prefix: "WEATHER WARNING",
    thunderstorm: "Thunderstorm expected",
    heavy_rain: "Heavy rain expected",
    downpour: "Intense downpour expected",
    strong_wind: "Strong winds expected",
    cyclone: "Cyclone nearby",
    safety: "Stay safe, follow local advisories.",
  },
  kn: {
    prefix: "ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ",
    thunderstorm: "ಗುಡುಗು ಸಹಿತ ಮಳೆ ಸಾಧ್ಯತೆ",
    heavy_rain: "ಭಾರೀ ಮಳೆ ಸಾಧ್ಯತೆ",
    downpour: "ಅತಿ ತೀವ್ರ ಮಳೆ ಸಾಧ್ಯತೆ",
    strong_wind: "ಬಲವಾದ ಗಾಳಿ ಸಾಧ್ಯತೆ",
    cyclone: "ಚಂಡಮಾರುತ ಹತ್ತಿರದಲ್ಲಿದೆ",
    safety: "ಸುರಕ್ಷಿತವಾಗಿರಿ, ಸ್ಥಳೀಯ ಸೂಚನೆಗಳನ್ನು ಪಾಲಿಸಿ.",
  },
  hi: {
    prefix: "मौसम चेतावनी",
    thunderstorm: "आंधी-तूफ़ान की संभावना",
    heavy_rain: "भारी बारिश की संभावना",
    downpour: "बहुत तेज़ बारिश की संभावना",
    strong_wind: "तेज़ हवाओं की संभावना",
    cyclone: "चक्रवात पास में है",
    safety: "सुरक्षित रहें, स्थानीय निर्देशों का पालन करें।",
  },
};

/* ─── Full report wording (email + SMS) ─────────────────────────────────────── */


type Dict = {
  locale: string;
  today: string;
  tomorrow: string;
  mm: string;
  kmh: string;
  conditions: Record<IconKind, string>;
  compass8: [string, string, string, string, string, string, string, string];
  aqi: [string, string, string, string, string, string];
  highLow: string;
  rain: string;
  wind: string;
  airQuality: string;
  humidity: string;
  periods: [string, string, string, string];
  sunrise: string;
  sunset: string;
  uvMax: string;
  sunshine: string;
  hours: string;
  issued: string;
  tipsHeading: string;
  farmHeading: string;
  openForecast: string;
  fullForecast: string;
  manage: string;
  unsubscribe: string;
  dataCredit: string;
  footer: (place: string, time: string, tz: string) => string;
  rainChanceShort: string;
  farmTitles: Record<FarmItem["key"], string>;
  farm: (i: FarmItem, dayName: (d: string) => string) => string;
  farmSms: (i: FarmItem) => string | null;
};

const T_EN: Dict = {
  locale: "en-IN",
  today: "Today",
  tomorrow: "Tomorrow",
  mm: "mm",
  kmh: "km/h",
  conditions: { clear: "Clear sky", partly: "Partly cloudy", cloudy: "Cloudy", fog: "Fog", drizzle: "Drizzle", rain: "Rain", "heavy-rain": "Heavy rain", snow: "Snow", storm: "Thunderstorm" },
  compass8: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  aqi: ["Good", "Moderate", "Unhealthy for sensitive groups", "Unhealthy", "Very unhealthy", "Hazardous"],
  highLow: "High / Low",
  rain: "Rain",
  wind: "Wind",
  airQuality: "Air quality",
  humidity: "Humidity",
  periods: ["Morning", "Afternoon", "Evening", "Night"],
  sunrise: "Sunrise",
  sunset: "Sunset",
  uvMax: "UV max",
  sunshine: "Sunshine",
  hours: "h",
  issued: "Issued",
  tipsHeading: "Tips for the day",
  farmHeading: "Farm advisory",
  openForecast: "Open full forecast",
  fullForecast: "Full forecast",
  manage: "Manage reports",
  unsubscribe: "Unsubscribe",
  dataCredit: "Weather data: Open-Meteo.com",
  footer: (p, t, tz) => `You're receiving this because you subscribed to daily weather for ${p} at ${t} (${tz}).`,
  rainChanceShort: "rain",
  farmTitles: {
    spray: "Spraying", irrigation: "Irrigation", soil: "Soil", disease: "Disease risk", livestock: "Livestock",
    harvest: "Harvest & drying", fertilizer: "Fertiliser", sowing: "Sowing", heavyRain: "Heavy rain", wind: "Strong wind", outlook: "Next 3 days",
  },
  farm: (i, dn) => {
    switch (i.key) {
      case "spray": return i.ok ? `Best time to spray: ${i.windows.join(", ")} (light wind, no rain expected).` : "Avoid spraying today — wind or rain would waste the spray.";
      case "irrigation":
        return i.need === "high" ? `Irrigation needed: crops will use about ${i.et0} mm of water and rain gives ${i.rain} mm. Water early morning or evening.`
          : i.need === "light" ? `Light irrigation is enough (about ${i.deficit} mm).`
          : `No irrigation needed: rain (${i.rain} mm) and soil moisture cover the crop's needs (${i.et0} mm).`;
      case "soil": return `Soil moisture: ${{ dry: "dry", moderate: "moderate", wet: "wet" }[i.level]} (${i.moisturePct}%).${i.tempC != null ? ` Soil temperature ${i.tempC}°C.` : ""}`;
      case "disease":
        return i.risk === "high" ? `High fungal disease risk (blast, blight, mildew): ${i.hours} hours of very humid weather. Inspect leaves and consider a preventive fungicide.`
          : i.risk === "moderate" ? "Moderate fungal disease risk — keep an eye on the leaves." : "Low disease risk.";
      case "livestock":
        return i.level === "severe" ? `Severe heat stress for cattle (THI ${i.thi}): give shade and plenty of water; avoid work from 11 am to 4 pm.`
          : i.level === "mild" ? `Mild heat stress for cattle (THI ${i.thi}): make sure they have shade and water.` : "Comfortable conditions for livestock.";
      case "harvest": return i.good ? "Good day for harvesting and drying produce (dry, low humidity)." : "Not ideal for harvesting or drying — rain or high humidity expected. Keep harvested produce covered.";
      case "fertilizer":
        return i.advice === "avoid" ? "Don't apply fertiliser now — heavy rain in the next 2 days may wash it away."
          : i.advice === "good" ? "Good time to apply fertiliser — light rain will help it soak in." : "If you apply fertiliser, irrigate afterwards.";
      case "sowing": return "Soil moisture is suitable for sowing.";
      case "heavyRain": return `Heavy rain (${i.mm} mm) expected — clear field drains and postpone harvesting and fertiliser.`;
      case "wind": return `Strong gusts (${i.gust} km/h) — support tall crops, banana and papaya plants.`;
      case "outlook": return i.days.map((d) => `${dn(d.date)}: ${d.rain} mm (${d.prob}%)`).join(" · ");
    }
  },
  farmSms: (i) => {
    switch (i.key) {
      case "spray": return i.ok ? `Spray ${i.windows[0]}` : "No spraying";
      case "irrigation": return i.need === "none" ? "No irrigation" : `Irrigate ~${Math.max(i.deficit, 1)}mm`;
      case "disease": return i.risk === "high" ? "Fungal risk high" : null;
      case "livestock": return i.level !== "ok" ? "Cattle heat stress" : null;
      case "heavyRain": return `Heavy rain ${i.mm}mm, clear drains`;
      case "fertilizer": return i.advice === "avoid" ? "No fertiliser" : null;
      case "harvest": return i.good ? "Good for harvest" : null;
      default: return null;
    }
  },
};

const T_KN: Dict = {
  locale: "kn-IN",
  today: "ಇಂದು",
  tomorrow: "ನಾಳೆ",
  mm: "ಮಿ.ಮೀ",
  kmh: "ಕಿ.ಮೀ/ಗಂ",
  conditions: { clear: "ಶುಭ್ರ ಆಕಾಶ", partly: "ಭಾಗಶಃ ಮೋಡ", cloudy: "ಮೋಡ ಕವಿದ ವಾತಾವರಣ", fog: "ಮಂಜು", drizzle: "ತುಂತುರು ಮಳೆ", rain: "ಮಳೆ", "heavy-rain": "ಭಾರೀ ಮಳೆ", snow: "ಹಿಮ", storm: "ಗುಡುಗು ಸಹಿತ ಮಳೆ" },
  compass8: ["ಉತ್ತರ", "ಈಶಾನ್ಯ", "ಪೂರ್ವ", "ಆಗ್ನೇಯ", "ದಕ್ಷಿಣ", "ನೈಋತ್ಯ", "ಪಶ್ಚಿಮ", "ವಾಯುವ್ಯ"],
  aqi: ["ಉತ್ತಮ", "ಸಾಧಾರಣ", "ಸೂಕ್ಷ್ಮ ಜನರಿಗೆ ಅನಾರೋಗ್ಯಕರ", "ಅನಾರೋಗ್ಯಕರ", "ತುಂಬಾ ಅನಾರೋಗ್ಯಕರ", "ಅಪಾಯಕಾರಿ"],
  highLow: "ಗರಿಷ್ಠ / ಕನಿಷ್ಠ",
  rain: "ಮಳೆ",
  wind: "ಗಾಳಿ",
  airQuality: "ಗಾಳಿಯ ಗುಣಮಟ್ಟ",
  humidity: "ಆರ್ದ್ರತೆ",
  periods: ["ಬೆಳಿಗ್ಗೆ", "ಮಧ್ಯಾಹ್ನ", "ಸಂಜೆ", "ರಾತ್ರಿ"],
  sunrise: "ಸೂರ್ಯೋದಯ",
  sunset: "ಸೂರ್ಯಾಸ್ತ",
  uvMax: "ಗರಿಷ್ಠ UV",
  sunshine: "ಬಿಸಿಲು",
  hours: "ಗಂಟೆ",
  issued: "ಪ್ರಕಟಣೆ",
  tipsHeading: "ಇಂದಿನ ಸಲಹೆಗಳು",
  farmHeading: "ಕೃಷಿ ಸಲಹೆ",
  openForecast: "ಪೂರ್ಣ ಮುನ್ಸೂಚನೆ ನೋಡಿ",
  fullForecast: "ಪೂರ್ಣ ಮುನ್ಸೂಚನೆ",
  manage: "ವರದಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ",
  unsubscribe: "ಚಂದಾದಾರಿಕೆ ರದ್ದುಮಾಡಿ",
  dataCredit: "ಹವಾಮಾನ ಮಾಹಿತಿ: Open-Meteo.com",
  footer: (p, t, tz) => `${p} ಸ್ಥಳದ ದೈನಂದಿನ ಹವಾಮಾನ ವರದಿಗೆ (${t}, ${tz}) ನೀವು ಚಂದಾದಾರರಾಗಿರುವುದರಿಂದ ಈ ಇಮೇಲ್ ಬಂದಿದೆ.`,
  rainChanceShort: "ಮಳೆ",
  farmTitles: {
    spray: "ಔಷಧಿ ಸಿಂಪಡಣೆ", irrigation: "ನೀರಾವರಿ", soil: "ಮಣ್ಣು", disease: "ರೋಗದ ಅಪಾಯ", livestock: "ಜಾನುವಾರು",
    harvest: "ಕೊಯ್ಲು ಮತ್ತು ಒಣಗಿಸುವಿಕೆ", fertilizer: "ಗೊಬ್ಬರ", sowing: "ಬಿತ್ತನೆ", heavyRain: "ಭಾರೀ ಮಳೆ", wind: "ಬಲವಾದ ಗಾಳಿ", outlook: "ಮುಂದಿನ 3 ದಿನಗಳು",
  },
  farm: (i, dn) => {
    switch (i.key) {
      case "spray": return i.ok ? `ಸಿಂಪಡಣೆಗೆ ಉತ್ತಮ ಸಮಯ: ${i.windows.join(", ")} (ಕಡಿಮೆ ಗಾಳಿ, ಮಳೆ ಇಲ್ಲ).` : "ಇಂದು ಸಿಂಪಡಣೆ ಬೇಡ — ಗಾಳಿ ಅಥವಾ ಮಳೆಯಿಂದ ಔಷಧಿ ವ್ಯರ್ಥವಾಗುತ್ತದೆ.";
      case "irrigation":
        return i.need === "high" ? `ನೀರಾವರಿ ಅಗತ್ಯ: ಬೆಳೆಗಳು ಸುಮಾರು ${i.et0} ಮಿ.ಮೀ ನೀರು ಬಳಸುತ್ತವೆ, ಮಳೆ ${i.rain} ಮಿ.ಮೀ ಮಾತ್ರ. ಬೆಳಿಗ್ಗೆ ಬೇಗ ಅಥವಾ ಸಂಜೆ ನೀರು ಹಾಯಿಸಿ.`
          : i.need === "light" ? `ಸ್ವಲ್ಪ ನೀರಾವರಿ ಸಾಕು (ಸುಮಾರು ${i.deficit} ಮಿ.ಮೀ).`
          : `ನೀರಾವರಿ ಬೇಡ: ಮಳೆ (${i.rain} ಮಿ.ಮೀ) ಮತ್ತು ಮಣ್ಣಿನ ತೇವಾಂಶ ಬೆಳೆಯ ಅಗತ್ಯವನ್ನು (${i.et0} ಮಿ.ಮೀ) ಪೂರೈಸುತ್ತವೆ.`;
      case "soil": return `ಮಣ್ಣಿನ ತೇವಾಂಶ: ${{ dry: "ಒಣ", moderate: "ಸಾಧಾರಣ", wet: "ತೇವ" }[i.level]} (${i.moisturePct}%).${i.tempC != null ? ` ಮಣ್ಣಿನ ತಾಪಮಾನ ${i.tempC}°C.` : ""}`;
      case "disease":
        return i.risk === "high" ? `ಶಿಲೀಂಧ್ರ ರೋಗದ ಅಪಾಯ ಹೆಚ್ಚು (ಬೆಂಕಿ ರೋಗ, ಎಲೆ ಕೊಳೆ, ಬೂದಿ ರೋಗ): ${i.hours} ಗಂಟೆಗಳ ಕಾಲ ಹೆಚ್ಚು ತೇವಾಂಶ. ಎಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಮುಂಜಾಗ್ರತಾ ಶಿಲೀಂಧ್ರನಾಶಕ ಬಳಸಿ.`
          : i.risk === "moderate" ? "ಶಿಲೀಂಧ್ರ ರೋಗದ ಸಾಧಾರಣ ಅಪಾಯ — ಎಲೆಗಳನ್ನು ಗಮನಿಸುತ್ತಿರಿ." : "ರೋಗದ ಅಪಾಯ ಕಡಿಮೆ.";
      case "livestock":
        return i.level === "severe" ? `ಜಾನುವಾರುಗಳಿಗೆ ತೀವ್ರ ಬಿಸಿಲಿನ ಒತ್ತಡ (THI ${i.thi}): ನೆರಳು ಮತ್ತು ಸಾಕಷ್ಟು ನೀರು ಕೊಡಿ; ಬೆಳಿಗ್ಗೆ 11 ರಿಂದ ಸಂಜೆ 4 ರವರೆಗೆ ಕೆಲಸ ಬೇಡ.`
          : i.level === "mild" ? `ಜಾನುವಾರುಗಳಿಗೆ ಸ್ವಲ್ಪ ಬಿಸಿಲಿನ ಒತ್ತಡ (THI ${i.thi}): ನೆರಳು ಮತ್ತು ನೀರು ಒದಗಿಸಿ.` : "ಜಾನುವಾರುಗಳಿಗೆ ಹಿತಕರ ವಾತಾವರಣ.";
      case "harvest": return i.good ? "ಕೊಯ್ಲು ಮತ್ತು ಬೆಳೆ ಒಣಗಿಸಲು ಉತ್ತಮ ದಿನ (ಒಣ ಹವಾಮಾನ, ಕಡಿಮೆ ತೇವಾಂಶ)." : "ಕೊಯ್ಲು ಅಥವಾ ಒಣಗಿಸಲು ಸೂಕ್ತವಲ್ಲ — ಮಳೆ ಅಥವಾ ಹೆಚ್ಚು ತೇವಾಂಶ ಸಾಧ್ಯತೆ. ಕೊಯ್ದ ಬೆಳೆಯನ್ನು ಮುಚ್ಚಿಡಿ.";
      case "fertilizer":
        return i.advice === "avoid" ? "ಈಗ ಗೊಬ್ಬರ ಹಾಕಬೇಡಿ — ಮುಂದಿನ 2 ದಿನಗಳ ಭಾರೀ ಮಳೆ ಅದನ್ನು ಕೊಚ್ಚಿಕೊಂಡು ಹೋಗಬಹುದು."
          : i.advice === "good" ? "ಗೊಬ್ಬರ ಹಾಕಲು ಸೂಕ್ತ ಸಮಯ — ಹಗುರ ಮಳೆ ಅದು ಮಣ್ಣಿನಲ್ಲಿ ಸೇರಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ." : "ಗೊಬ್ಬರ ಹಾಕಿದರೆ ನಂತರ ನೀರು ಹಾಯಿಸಿ.";
      case "sowing": return "ಬಿತ್ತನೆಗೆ ಮಣ್ಣಿನ ತೇವಾಂಶ ಸೂಕ್ತವಾಗಿದೆ.";
      case "heavyRain": return `ಭಾರೀ ಮಳೆ (${i.mm} ಮಿ.ಮೀ) ನಿರೀಕ್ಷೆ — ಹೊಲದ ಕಾಲುವೆಗಳನ್ನು ಸ್ವಚ್ಛಗೊಳಿಸಿ, ಕೊಯ್ಲು ಮತ್ತು ಗೊಬ್ಬರ ಮುಂದೂಡಿ.`;
      case "wind": return `ಬಲವಾದ ಗಾಳಿ (${i.gust} ಕಿ.ಮೀ/ಗಂ) — ಎತ್ತರದ ಬೆಳೆಗಳು, ಬಾಳೆ ಮತ್ತು ಪಪ್ಪಾಯ ಗಿಡಗಳಿಗೆ ಆಧಾರ ಕೊಡಿ.`;
      case "outlook": return i.days.map((d) => `${dn(d.date)}: ${d.rain} ಮಿ.ಮೀ (${d.prob}%)`).join(" · ");
    }
  },
  farmSms: (i) => {
    switch (i.key) {
      case "spray": return i.ok ? `ಸಿಂಪಡಣೆ ${i.windows[0]}` : "ಸಿಂಪಡಣೆ ಬೇಡ";
      case "irrigation": return i.need === "none" ? "ನೀರಾವರಿ ಬೇಡ" : `ನೀರಾವರಿ ~${Math.max(i.deficit, 1)}ಮಿ.ಮೀ`;
      case "disease": return i.risk === "high" ? "ಶಿಲೀಂಧ್ರ ರೋಗ ಅಪಾಯ ಹೆಚ್ಚು" : null;
      case "livestock": return i.level !== "ok" ? "ಜಾನುವಾರು ಬಿಸಿಲಿನ ಒತ್ತಡ" : null;
      case "heavyRain": return `ಭಾರೀ ಮಳೆ ${i.mm}ಮಿ.ಮೀ, ಕಾಲುವೆ ಸ್ವಚ್ಛಗೊಳಿಸಿ`;
      case "fertilizer": return i.advice === "avoid" ? "ಗೊಬ್ಬರ ಬೇಡ" : null;
      case "harvest": return i.good ? "ಕೊಯ್ಲಿಗೆ ಸೂಕ್ತ" : null;
      default: return null;
    }
  },
};

const T_HI: Dict = {
  locale: "hi-IN",
  today: "आज",
  tomorrow: "कल",
  mm: "मिमी",
  kmh: "किमी/घंटा",
  conditions: { clear: "साफ़ आसमान", partly: "आंशिक बादल", cloudy: "बादल छाए", fog: "कोहरा", drizzle: "बूंदाबांदी", rain: "बारिश", "heavy-rain": "भारी बारिश", snow: "बर्फ़बारी", storm: "आंधी-तूफ़ान" },
  compass8: ["उत्तर", "उत्तर-पूर्व", "पूर्व", "दक्षिण-पूर्व", "दक्षिण", "दक्षिण-पश्चिम", "पश्चिम", "उत्तर-पश्चिम"],
  aqi: ["अच्छा", "मध्यम", "संवेदनशील लोगों के लिए अस्वास्थ्यकर", "अस्वास्थ्यकर", "बहुत अस्वास्थ्यकर", "खतरनाक"],
  highLow: "अधिकतम / न्यूनतम",
  rain: "बारिश",
  wind: "हवा",
  airQuality: "वायु गुणवत्ता",
  humidity: "नमी",
  periods: ["सुबह", "दोपहर", "शाम", "रात"],
  sunrise: "सूर्योदय",
  sunset: "सूर्यास्त",
  uvMax: "अधिकतम UV",
  sunshine: "धूप",
  hours: "घंटे",
  issued: "जारी",
  tipsHeading: "आज के सुझाव",
  farmHeading: "कृषि सलाह",
  openForecast: "पूरा पूर्वानुमान देखें",
  fullForecast: "पूरा पूर्वानुमान",
  manage: "रिपोर्ट प्रबंधित करें",
  unsubscribe: "सदस्यता समाप्त करें",
  dataCredit: "मौसम डेटा: Open-Meteo.com",
  footer: (p, t, tz) => `आपने ${p} के लिए दैनिक मौसम रिपोर्ट (${t}, ${tz}) की सदस्यता ली है, इसलिए यह ईमेल मिला है।`,
  rainChanceShort: "बारिश",
  farmTitles: {
    spray: "छिड़काव", irrigation: "सिंचाई", soil: "मिट्टी", disease: "रोग का खतरा", livestock: "पशुधन",
    harvest: "कटाई और सुखाना", fertilizer: "खाद", sowing: "बुवाई", heavyRain: "भारी बारिश", wind: "तेज़ हवा", outlook: "अगले 3 दिन",
  },
  farm: (i, dn) => {
    switch (i.key) {
      case "spray": return i.ok ? `छिड़काव का सबसे अच्छा समय: ${i.windows.join(", ")} (हल्की हवा, बारिश नहीं)।` : "आज छिड़काव न करें — हवा या बारिश से दवा बेकार जाएगी।";
      case "irrigation":
        return i.need === "high" ? `सिंचाई ज़रूरी: फसलें लगभग ${i.et0} मिमी पानी इस्तेमाल करेंगी और बारिश सिर्फ़ ${i.rain} मिमी होगी। सुबह जल्दी या शाम को पानी दें।`
          : i.need === "light" ? `हल्की सिंचाई पर्याप्त है (लगभग ${i.deficit} मिमी)।`
          : `सिंचाई की ज़रूरत नहीं: बारिश (${i.rain} मिमी) और मिट्टी की नमी फसल की ज़रूरत (${i.et0} मिमी) पूरी करेगी।`;
      case "soil": return `मिट्टी की नमी: ${{ dry: "सूखी", moderate: "सामान्य", wet: "गीली" }[i.level]} (${i.moisturePct}%)।${i.tempC != null ? ` मिट्टी का तापमान ${i.tempC}°C।` : ""}`;
      case "disease":
        return i.risk === "high" ? `फफूंद रोग का खतरा ज़्यादा (ब्लास्ट, झुलसा, फफूंदी): ${i.hours} घंटे तक बहुत ज़्यादा नमी। पत्तियों की जाँच करें और बचाव के लिए फफूंदनाशक पर विचार करें।`
          : i.risk === "moderate" ? "फफूंद रोग का मध्यम खतरा — पत्तियों पर नज़र रखें।" : "रोग का खतरा कम।";
      case "livestock":
        return i.level === "severe" ? `पशुओं पर तेज़ गर्मी का असर (THI ${i.thi}): छाया और भरपूर पानी दें; सुबह 11 से शाम 4 बजे तक काम न कराएँ।`
          : i.level === "mild" ? `पशुओं पर हल्का गर्मी का असर (THI ${i.thi}): छाया और पानी की व्यवस्था करें।` : "पशुओं के लिए अनुकूल मौसम।";
      case "harvest": return i.good ? "कटाई और उपज सुखाने के लिए अच्छा दिन (सूखा मौसम, कम नमी)।" : "कटाई या सुखाने के लिए ठीक नहीं — बारिश या ज़्यादा नमी की संभावना। काटी गई उपज को ढककर रखें।";
      case "fertilizer":
        return i.advice === "avoid" ? "अभी खाद न डालें — अगले 2 दिनों में भारी बारिश इसे बहा सकती है।"
          : i.advice === "good" ? "खाद डालने का अच्छा समय — हल्की बारिश इसे मिट्टी में मिलाने में मदद करेगी।" : "खाद डालें तो उसके बाद सिंचाई करें।";
      case "sowing": return "बुवाई के लिए मिट्टी में पर्याप्त नमी है।";
      case "heavyRain": return `भारी बारिश (${i.mm} मिमी) की संभावना — खेत की नालियाँ साफ़ करें, कटाई और खाद डालना टालें।`;
      case "wind": return `तेज़ झोंके (${i.gust} किमी/घंटा) — ऊँची फसलों, केला और पपीता के पौधों को सहारा दें।`;
      case "outlook": return i.days.map((d) => `${dn(d.date)}: ${d.rain} मिमी (${d.prob}%)`).join(" · ");
    }
  },
  farmSms: (i) => {
    switch (i.key) {
      case "spray": return i.ok ? `छिड़काव ${i.windows[0]}` : "छिड़काव न करें";
      case "irrigation": return i.need === "none" ? "सिंचाई नहीं" : `सिंचाई ~${Math.max(i.deficit, 1)}मिमी`;
      case "disease": return i.risk === "high" ? "फफूंद रोग खतरा ज़्यादा" : null;
      case "livestock": return i.level !== "ok" ? "पशु गर्मी तनाव" : null;
      case "heavyRain": return `भारी बारिश ${i.mm}मिमी, नाली साफ़ करें`;
      case "fertilizer": return i.advice === "avoid" ? "खाद न डालें" : null;
      case "harvest": return i.good ? "कटाई के लिए अच्छा" : null;
      default: return null;
    }
  },
};

export const REPORT_TEXT: Record<Lang, Dict> = { en: T_EN, kn: T_KN, hi: T_HI };

/** 8-point wind direction in the report language. */
export function compassWord(deg: number, lang: Lang) {
  return REPORT_TEXT[lang].compass8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** AQI category in the report language. */
export function aqiWord(aqi: number, lang: Lang) {
  const i = aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : aqi <= 200 ? 3 : aqi <= 300 ? 4 : 5;
  return REPORT_TEXT[lang].aqi[i];
}

/** Localised date strings (Node ships full ICU, so kn-IN and hi-IN month/day names work). */
export function localDate(isoDate: string, lang: Lang, style: "long" | "short" = "long") {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString(REPORT_TEXT[lang].locale, {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
  });
}
