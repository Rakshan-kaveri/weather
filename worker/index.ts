/**
 * Background worker: sends daily weather reports and evaluates alert rules.
 * Run alongside the web app:  npm run worker   (PM2 keeps it alive in production)
 */
import cron from "node-cron";
import { runDailyReports } from "../src/lib/deliver";
import { runAlerts } from "../src/lib/alerts";
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

async function cleanup() {
  // Keep the job log small: delete runs older than 14 days.
  await prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 14 * 86400_000) } } });
}

cron.schedule("*/5 * * * *", reports);
cron.schedule("10 * * * *", alerts);
cron.schedule("30 3 * * *", cleanup);

console.log("SkyCast worker started — reports every 5 min, alerts hourly.");
void reports();

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
