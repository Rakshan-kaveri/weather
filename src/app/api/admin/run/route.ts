import { z } from "zod";
import { apiAdmin, body, handler, json } from "@/lib/api";
import { runDailyReports } from "@/lib/deliver";
import { runAlerts } from "@/lib/alerts";

/** POST /api/admin/run { job } → run a scheduler job now (useful for demos) */
export const POST = handler(async (req: Request) => {
  await apiAdmin();
  const { job } = await body(req, z.object({ job: z.enum(["daily-reports", "alerts"]) }));
  const result = job === "alerts" ? await runAlerts() : await runDailyReports();
  return json({ ok: true, result });
});
