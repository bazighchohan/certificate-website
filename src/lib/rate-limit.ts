import "server-only";

/**
 * Simple in-memory sliding-window rate limiter.
 * Note: state is per server instance. On multi-instance/serverless hosting the
 * effective limit is per instance; use a shared store (e.g. Redis) for a strict limit.
 */
const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Periodically drop idle keys so the map doesn't grow without bound.
  if (now - lastSweep > windowMs) {
    for (const [k, ts] of hits) if (ts[ts.length - 1] <= cutoff) hits.delete(k);
    lastSweep = now;
  }

  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
