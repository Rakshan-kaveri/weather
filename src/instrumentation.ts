/**
 * Runs once when the server starts. Pre-loads the slow upstream data (satellite frame list from EUMETSAT,
 * GDACS cyclones) and keeps it fresh in the background, so visitors never wait for it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { cached } = await import("./lib/cache");
  const { satelliteSources } = await import("./lib/satellite");
  const { activeCyclones } = await import("./lib/severe");

  const warm = async () => {
    await Promise.allSettled([cached("sat:sources", 300, satelliteSources), activeCyclones()]);
  };
  setTimeout(() => void warm(), 2000);
  setInterval(() => void warm(), 4 * 60_000).unref?.();
}
