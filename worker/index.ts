/**
 * Background worker: sends daily weather reports and evaluates alert rules.
 * Run alongside the web app:  npm run worker   (PM2 keeps it alive in production)
 */
import cron from "node-cron";
import { runDailyReports } from "../src/lib/deliver";
import { runAlerts } from "../src/lib/alerts";
import { runSevereWatch } from "../src/lib/severeWatch";
import { prisma } from "../src/lib/prisma";

let reportsRunning = false;
let alertsRunning = false;

async function reports() {
  if (reportsRunning) return;
  reportsRunning = true;
  try {
    const r = await runDailyReports();
    if (r.processed) console.log(`[${new Date().toISOString()}] daily reports: ${r.sent} sent, ${r.failed} failed`);
  } catch (err) {
    console.error("daily reports failed", err);
  } finally {
    reportsRunning = false;
  }
}

async function alerts() {
  if (alertsRunning) return;
  alertsRunning = true;
  try {
    const r = await runAlerts();
    console.log(`[${new Date().toISOString()}] alerts: ${r.processed} rules checked, ${r.sent} sent`);
  } catch (err) {
    console.error("alerts failed", err);
  } finally {
    alertsRunning = false;
  }
}

let severeRunning = false;
async function severe() {
  if (severeRunning) return;
  severeRunning = true;
  try {
    const r = await runSevereWatch();
    if (r.sent) console.log(`[${new Date().toISOString()}] severe weather: ${r.sent} warnings sent`);
  } catch (err) {
    console.error("severe weather watch failed", err);
  } finally {
    severeRunning = false;
  }
}

async function cleanup() {
  // Keep the job log small: delete runs older than 14 days.
  await prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 14 * 86400_000) } } });
}

cron.schedule("*/5 * * * *", reports);
cron.schedule("10 * * * *", alerts);
cron.schedule("20,50 * * * *", severe);
cron.schedule("30 3 * * *", cleanup);

console.log("SkyCast worker started — reports every 5 min, alerts hourly, severe-weather watch every 30 min.");
void reports();
void severe();

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
