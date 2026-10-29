import { handler, json } from "@/lib/api";
import { activeCyclones } from "@/lib/severe";

export const dynamic = "force-dynamic";

/** GET /api/cyclones → active tropical cyclones worldwide (GDACS) */
export const GET = handler(async () => {
  const cyclones = await activeCyclones().catch(() => []);
  return json({ cyclones }, { headers: { "Cache-Control": "public, max-age=900" } });
});
