import { NextRequest, NextResponse } from "next/server";
import { react } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as any);
  if (body.key) react(String(body.key));
  return NextResponse.json({ ok: true });
}
