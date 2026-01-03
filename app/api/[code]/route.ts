// app/api/[code]/route.ts
import { NextResponse } from "next/server";
import { resolveCode } from "@/lib/redirectResolver";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const result = await resolveCode(code);

  if (result.kind === "not_found") {
    return new NextResponse("Not found", { status: 404 });
  }

  if (result.kind === "expired") {
    return new NextResponse("Gone", { status: 410 });
  }

  // 302 redirect (per your spec)
  return NextResponse.redirect(result.longUrl, 302);
}

