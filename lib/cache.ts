// lib/cache.ts
type CacheEntry = {
    longUrl: string;
    expiresAtMs: number; // epoch ms
  };
  
  const MAX_ENTRIES = 50_000;
  
  // Map preserves insertion order, which lets us do FIFO eviction cheaply.
  const cache = new Map<string, CacheEntry>();
  
  export function cacheGet(code: string): string | null {
    const entry = cache.get(code);
    if (!entry) return null;
  
    // Expiration check (invariant: expired must not redirect)
    if (entry.expiresAtMs < Date.now()) {
      cache.delete(code);
      return null;
    }
  
    return entry.longUrl;
  }
  
  export function cacheSet(code: string, longUrl: string, expiresAtMs: number) {
    // If key already exists, delete first so insertion order updates (helps FIFO be consistent)
    if (cache.has(code)) cache.delete(code);
    cache.set(code, { longUrl, expiresAtMs });
  
    // FIFO eviction: remove oldest inserted until under limit
    while (cache.size > MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }
  
  // Test helpers (safe to keep; not used by runtime routes)
  export function __cacheClear() {
    cache.clear();
  }
  
  export function __cacheSize() {
    return cache.size;
  }
  