export const APP_NAME = "SkyCast";

export const config = {
  appUrl: (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  emailFrom: process.env.EMAIL_FROM || "SkyCast <weather@example.com>",
  contactEmail: process.env.CONTACT_EMAIL || "admin@example.com",
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
};

export function isAdminEmail(email?: string | null) {
  return !!email && config.adminEmails.includes(email.toLowerCase());
}
