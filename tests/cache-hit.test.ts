// tests/cache-hit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { __cacheClear } from "@/lib/cache";
import { resolveCode } from "@/lib/redirectResolver";

// Mock the DB layer
vi.mock("@/lib/linksRepo", () => {
  return {
    getLinkByCode: vi.fn(),
  };
});

import { getLinkByCode } from "@/lib/linksRepo";

describe("cache behavior", () => {
  beforeEach(() => {
    __cacheClear();
    vi.resetAllMocks();
  });

  it("uses DB on first request, cache on second", async () => {
    // Arrange: DB returns a valid link
    (getLinkByCode as any).mockResolvedValue({
      code: "abc1234",
      long_url: "https://example.com/x",
      expires_at: new Date(Date.now() + 60_000).toISOString(), // valid 1 min
    });

    // Act 1: should hit DB
    const r1 = await resolveCode("abc1234");
    expect(r1.kind).toBe("redirect");
    expect(getLinkByCode).toHaveBeenCalledTimes(1);

    // Act 2: should hit cache (no additional DB call)
    const r2 = await resolveCode("abc1234");
    expect(r2.kind).toBe("redirect");
    expect(getLinkByCode).toHaveBeenCalledTimes(1);
  });

  it("expired cache entry behaves like a miss (and then expires)", async () => {
    // First call returns expired from DB
    (getLinkByCode as any).mockResolvedValue({
      code: "deadbee",
      long_url: "https://example.com/expired",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const r1 = await resolveCode("deadbee");
    expect(r1.kind).toBe("expired");
    expect(getLinkByCode).toHaveBeenCalledTimes(1);

    // Second call: still expired (cache should not return redirect)
    const r2 = await resolveCode("deadbee");
    expect(r2.kind).toBe("expired");
    expect(getLinkByCode).toHaveBeenCalledTimes(2);
  });
});
