import { NextResponse } from "next/server";
import { __cacheClear } from "@/lib/cache";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  __cacheClear();
  return NextResponse.json({ ok: true });
}
