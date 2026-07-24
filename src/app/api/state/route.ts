import { NextResponse } from "next/server";
import { getState } from "@/lib/player";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sid = await getSessionId();
  return NextResponse.json(await getState(sid));
}
