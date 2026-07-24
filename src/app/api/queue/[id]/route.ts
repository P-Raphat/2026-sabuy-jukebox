import { NextResponse } from "next/server";
import { remove, LimitError } from "@/lib/player";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cancel own song (ownership enforced by session).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await getSessionId();
  try {
    await remove(id, sid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof LimitError ? e.message : "Could not remove";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
