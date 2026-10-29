/**
 * Tiny in-memory TTL cache with request de-duplication.
 * Keeps the free weather APIs well inside their limits.
 */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 2000;

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = (async () => {
    try {
      const value = await fn();
      if (store.size >= MAX_ENTRIES) {
        const firstKey = store.keys().next().value;
        if (firstKey !== undefined) store.delete(firstKey);
      }
      store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Simple fixed-window rate limiter keyed by IP (or any string). */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowSeconds * 1000 });
    if (buckets.size > 10000) buckets.clear();
    return true;
  }
  b.count++;
  return b.count <= limit;
}
