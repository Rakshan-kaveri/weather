import { Resend } from "resend";
import nodemailer from "nodemailer";
import { config } from "./config";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
};

export type SendResult = { provider: "resend" | "smtp" | "console"; id: string };

let resend: Resend | null = null;
let smtp: nodemailer.Transporter | null = null;

export function emailProvider(): SendResult["provider"] {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "console";
}

/**
 * Sends an email through Resend (preferred), any SMTP server (fallback), or logs it in development.
 * Throws on failure so the caller can record the error on the delivery row.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const headers: Record<string, string> = {};
  if (msg.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${msg.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const provider = emailProvider();
  if (provider === "resend") {
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: config.emailFrom,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers,
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    return { provider, id: data?.id ?? "" };
  }

  if (provider === "smtp") {
    smtp ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await smtp.sendMail({
      from: config.emailFrom,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers,
    });
    return { provider, id: info.messageId };
  }

  console.log(`[email:console] to=${msg.to} subject="${msg.subject}"`);
  return { provider, id: `console-${Date.now()}` };
}
