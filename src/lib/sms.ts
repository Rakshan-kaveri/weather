/**
 * SMS through textbee.dev — an open-source gateway that sends messages from an Android phone's own SIM.
 * Free plan: 1 device, 50 SMS/day, 300 SMS/month. The SIM's normal SMS pack pays for the messages.
 */

export type SmsResult = { provider: "textbee" | "console"; id: string };

export function smsEnabled() {
  return !!(process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID);
}

/** Normalises an Indian or international number to E.164 (+91XXXXXXXXXX). */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const only = digits.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(only)) return `+91${only}`;
  if (/^91[6-9]\d{9}$/.test(only)) return `+${only}`;
  if (/^0[6-9]\d{9}$/.test(only)) return `+91${only.slice(1)}`;
  return null;
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  if (!smsEnabled()) {
    console.log(`[sms:console] to=${to} "${message}"`);
    return { provider: "console", id: `console-${Date.now()}` };
  }
  const res = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: { "x-api-key": process.env.TEXTBEE_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ recipients: [to], message, deviceId: process.env.TEXTBEE_DEVICE_ID }),
    signal: AbortSignal.timeout(15000),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = j?.error || j?.message || `HTTP ${res.status}`;
    throw new Error(res.status === 429 ? `SMS daily limit reached (${reason})` : `SMS gateway error: ${reason}`);
  }
  return { provider: "textbee", id: j?.data?.smsBatchId ?? "" };
}
