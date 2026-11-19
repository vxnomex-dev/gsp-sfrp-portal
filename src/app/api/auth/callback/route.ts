import { queryOne } from "@/lib/db";
import { THEME_COOKIE } from "@/lib/theme";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchMemberRoles, fetchUser } from "@/lib/discord";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("gsp_oauth_state")?.value;
  const next = req.cookies.get("gsp_oauth_next")?.value || "/portal";

  // User pressed "Cancel", or prompt=none needs consent -> retry with consent screen
  const error = url.searchParams.get("error");
  if (error === "consent_required" || error === "interaction_required") {
    const { authorizeUrl } = await import("@/lib/discord");
    const s = crypto.randomUUID();
    const res = NextResponse.redirect(authorizeUrl(s).replace("prompt=none", "prompt=consent"));
    res.cookies.set("gsp_oauth_state", s, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return res;
  }
  if (error || !code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/?login=failed", req.url));
  }

  try {
    const token = await exchangeCode(code);
    const user = await fetchUser(token);
    let roles: string[] = [];
    let inGuild = false;
    try {
      const r = await fetchMemberRoles(user.id, { fresh: true });
      roles = r ?? [];
      inGuild = r !== null;
    } catch {
      /* bot misconfigured — user can still log in, but gets no staff permissions */
    }

    const jwt = await createSessionToken({
      uid: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      avatar: user.avatar,
      roles,
      inGuild,
    });
    const res = NextResponse.redirect(new URL(next, req.url));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions);
    res.cookies.delete("gsp_oauth_state");
    res.cookies.delete("gsp_oauth_next");
    // Bring their saved light/dark choice to this device
    try {
      const prefs = await queryOne<{ theme: string }>(`SELECT theme FROM user_prefs WHERE user_id=$1`, [user.id]);
      if (prefs) res.cookies.set(THEME_COOKIE, prefs.theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    } catch {
      /* not important */
    }
    return res;
  } catch (e) {
    console.error("[auth] callback failed", e);
    return NextResponse.redirect(new URL("/?login=failed", req.url));
  }
}
