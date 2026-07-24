import { NextRequest, NextResponse } from "next/server";
import { resolve, RejectError } from "@/lib/youtube";
import { addSong, LimitError } from "@/lib/player";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Smart input: accepts a chosen search result (youtubeId) or raw URL/text.
export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  const body = await req.json().catch(() => ({}) as any);
  const input = String(body.youtubeId || body.input || "").trim();
  const name = body.name ? String(body.name) : undefined;
  if (!input) return NextResponse.json({ error: "Type a song or paste a link" }, { status: 400 });

  try {
    const meta = await resolve(input);
    const r = await addSong(meta, { session: sid, requester: name });
    return NextResponse.json({ ok: true, cached: r.cached, title: meta.title });
  } catch (e) {
    if (e instanceof RejectError || e instanceof LimitError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[queue.add]", e);
    return NextResponse.json({ error: "Something went wrong — try again" }, { status: 500 });
  }
}
