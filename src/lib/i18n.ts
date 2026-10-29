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
