import { NextRequest, NextResponse } from "next/server";
import { finished } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Player reports the current song ended; expectedItemId guards against races.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as any);
  await finished(body.queueItemId ? String(body.queueItemId) : undefined);
  return NextResponse.json({ ok: true });
}
