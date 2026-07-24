import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const SID_COOKIE = "sjb_sid";

// Anonymous session id from cookie. middleware.ts guarantees the cookie exists
// on navigations; API-only clients get one minted here as a fallback.
export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SID_COOKIE)?.value;
  if (existing) return existing;
  const sid = randomUUID();
  try {
    jar.set(SID_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } catch {
    // cookies() is read-only in some contexts; middleware covers the common path.
  }
  return sid;
}
