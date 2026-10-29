/**
 * Load .env before anything else in the worker. (Next.js loads .env for the website automatically,
 * but a plain Node process like this worker does not.) Must be the first import in worker/index.ts.
 */
import path from "node:path";

const file = path.join(process.cwd(), ".env");
try {
  process.loadEnvFile(file);
} catch {
  console.warn(`[worker] could not read ${file}; using existing environment variables`);
}
