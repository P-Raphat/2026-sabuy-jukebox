import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ results: await search(q, 5) });
  } catch (e) {
    console.error("[api/search]", q, e);
    return NextResponse.json({ results: [], error: "search_failed" }, { status: 502 });
  }
}
