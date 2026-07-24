import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SID = "sjb_sid";

// Ensure every visitor carries an anonymous session id (ownership of queued
// songs). Runs on the edge runtime, so use the global Web Crypto API.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(SID)) {
    res.cookies.set(SID, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
