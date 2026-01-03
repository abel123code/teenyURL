import { NextResponse } from "next/server";
import { createShortLink } from "@/lib/linksRepo";
import { validateLongUrl } from "@/lib/validate";
import { BASE_URL } from "@/lib/config";
import { fixedWindowRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rl = fixedWindowRateLimit({
    req,
    keyPrefix: "shorten",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too Many Requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: rl.headers }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const longUrlRaw = body?.longUrl;

    if (typeof longUrlRaw !== "string") {
      return NextResponse.json({ error: "longUrl is required" }, { status: 400 });
    }

    const longUrl = validateLongUrl(longUrlRaw);
    const row = await createShortLink(longUrl);

    return NextResponse.json(
      {
        code: row.code,
        shortUrl: `${BASE_URL}/${row.code}`,
        longUrl: row.long_url,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Internal error";
    const status = msg.startsWith("Invalid") || msg.includes("http/https") || msg.includes("too long") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
