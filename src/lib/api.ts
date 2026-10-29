import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { currentUser } from "./session";
import { rateLimit } from "./cache";
import { clientIp } from "./geo";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Wraps a route handler with consistent error responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError) {
        return json({ error: "Invalid input", issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
      }
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function apiUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

export async function apiAdmin() {
  const user = await apiUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Admins only.");
  return user;
}

export async function body<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  return schema.parse(data);
}

export function limit(req: Request, bucket: string, max = 60, windowSeconds = 60) {
  const ip = clientIp(req.headers) ?? "local";
  if (!rateLimit(`${bucket}:${ip}`, max, windowSeconds)) throw new HttpError(429, "Too many requests. Slow down a little.");
}

export function num(v: string | null, name: string) {
  const n = Number(v);
  if (v == null || v === "" || !Number.isFinite(n)) throw new HttpError(400, `Missing or invalid "${name}".`);
  return n;
}
