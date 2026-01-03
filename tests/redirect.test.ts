import { describe, it, expect } from "vitest";
import { getLinkByCode, createShortLink } from "@/lib/linksRepo";

describe.skip("redirect lookup", () => {
  it("returns null for missing code", async () => {
    const row = await getLinkByCode("zzzzzzz");
    expect(row).toBeNull();
  });

  it("returns a row for an existing code", async () => {
    const created = await createShortLink("https://example.com/b");
    const row = await getLinkByCode(created.code);
    expect(row?.code).toBe(created.code);
    expect(row?.long_url).toBe("https://example.com/b");
  });
});
