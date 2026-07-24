import { NextRequest, NextResponse } from "next/server";
import {
  skip,
  setPaused,
  stop,
  clearQueue,
  clearData,
  playNow,
  reorder,
  remove,
  LimitError,
} from "@/lib/player";
import { updateSettings } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: NextRequest) {
  return req.headers.get("x-admin-pass") === (process.env.ADMIN_PASSWORD || "changeme");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as any);
  const action = String(body.action || "");

  if (action === "login") return NextResponse.json({ ok: authed(req) });
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    switch (action) {
      case "skip": await skip(); break;
      case "pause": await setPaused(true); break;
      case "resume": await setPaused(false); break;
      case "stop": await stop(); break;
      case "clearQueue": await clearQueue(); break;
      case "clearData": await clearData(); break;
      case "playNow": await playNow(String(body.id)); break;
      case "reorder": await reorder(String(body.id), body.dir === -1 ? -1 : 1); break;
      case "remove": await remove(String(body.id)); break;
      case "config": await updateSettings(body.patch || {}); break;
      default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof LimitError ? e.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
