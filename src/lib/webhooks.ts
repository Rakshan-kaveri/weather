import crypto from "node:crypto";

/**
 * Resend signs webhooks with Svix: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}`,
 * keyed with the base64 part of the `whsec_...` secret. Header `svix-signature` holds "v1,<base64>" values.
 */
export function verifyResend(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return !!sig && safeEqual(sig, expected);
  });
}

/** textbee signs the raw body with HMAC-SHA256 (lowercase hex) in the `X-Signature` header. */
export function verifyTextbee(rawBody: string, headers: Headers, secret: string): boolean {
  const sig = headers.get("x-signature");
  if (!sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(sig.replace(/^sha256=/, "").toLowerCase(), expected);
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
