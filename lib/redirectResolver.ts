// lib/redirectResolver.ts
// Makes the read path explicit: cache → DB → cache
import { cacheGet, cacheSet } from "./cache";
import { getLinkByCode } from "./linksRepo";

export type ResolveResult =
  | { kind: "redirect"; longUrl: string }
  | { kind: "not_found" }
  | { kind: "expired" };

export async function resolveCode(code: string): Promise<ResolveResult> {
  // 1) Cache first
  const cached = cacheGet(code);
  if (cached) {
    return { kind: "redirect", longUrl: cached };
  }

  // 2) DB fallback
  const row = await getLinkByCode(code);
  if (!row) return { kind: "not_found" };

  const expiresAtMs = Date.parse(row.expires_at);
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    return { kind: "expired" };
  }

  // 3) Populate cache (store expiry to protect invariant)
  cacheSet(row.code, row.long_url, expiresAtMs);

  return { kind: "redirect", longUrl: row.long_url };
}
