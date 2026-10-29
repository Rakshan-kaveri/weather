import { handler, json } from "@/lib/api";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

/** GET /api/radar → list of recent rain-radar frames (RainViewer, past ~2 hours). */
export const GET = handler(async () => {
  const data = await cached("radar", 300, async () => {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Radar ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json();
    const frames = (j.radar?.past ?? []).map((f: { time: number; path: string }) => ({
      time: f.time,
      url: `${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
    }));
    return { frames };
  }).catch(() => ({ frames: [] }));
  return json(data, { headers: { "Cache-Control": "public, max-age=120" } });
});
