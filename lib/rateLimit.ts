// lib/rateLimit.ts
type Bucket = {
    count: number;
    resetAtMs: number;
  };
  
  const MAX_BUCKETS = 50_000;
  const buckets = new Map<string, Bucket>();
  
  function fifoEvictIfNeeded() {
    while (buckets.size > MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      buckets.delete(oldestKey);
    }
  }
  
  export function getClientIp(req: Request): string {
    // Behind proxies (Vercel), x-forwarded-for is usually set.
    // Format can be: "client, proxy1, proxy2"
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  
    // Fallbacks (often empty in local dev)
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  
    return "unknown";
  }
  
  export type RateLimitResult =
    | { ok: true; headers: Record<string, string> }
    | { ok: false; retryAfterSeconds: number; headers: Record<string, string> };
  
  export function fixedWindowRateLimit(opts: {
    req: Request;
    keyPrefix: string;        // e.g. "shorten"
    limit: number;            // e.g. 10
    windowMs: number;         // e.g. 60_000
    nowMs?: number;           // for tests
  }): RateLimitResult {
    const now = opts.nowMs ?? Date.now();
    const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
    const resetAtMs = windowStart + opts.windowMs;
  
    const ip = getClientIp(opts.req);
    const key = `${opts.keyPrefix}:${ip}:${windowStart}`;
  
    const bucket = buckets.get(key) ?? { count: 0, resetAtMs };
    bucket.count += 1;
    buckets.set(key, bucket);
  
    fifoEvictIfNeeded();
  
    const remaining = Math.max(0, opts.limit - bucket.count);
    const retryAfterSeconds = Math.max(0, Math.ceil((bucket.resetAtMs - now) / 1000));
  
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": String(opts.limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.floor(bucket.resetAtMs / 1000)), // epoch seconds
    };
  
    if (bucket.count > opts.limit) {
      headers["Retry-After"] = String(retryAfterSeconds);
      return { ok: false, retryAfterSeconds, headers };
    }
  
    return { ok: true, headers };
  }
  
  // Test helpers
  export function __rlClear() {
    buckets.clear();
  }
  export function __rlSize() {
    return buckets.size;
  }
  