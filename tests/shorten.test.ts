import { describe, it, expect } from "vitest";
import { createShortLink } from "@/lib/linksRepo";
import { validateLongUrl } from "@/lib/validate";

describe.skip("shorten", () => {
  it("validates URLs (http/https only)", () => {
    expect(() => validateLongUrl("notaurl")).toThrow();
    expect(() => validateLongUrl("javascript:alert(1)")).toThrow();
    expect(validateLongUrl("https://example.com")).toBe("https://example.com/");
  });

  it("creates a short link with code length 7", async () => {
    const row = await createShortLink("https://example.com/a");
    expect(row.code.length).toBe(7);
    expect(row.long_url).toBe("https://example.com/a");
  });
});
