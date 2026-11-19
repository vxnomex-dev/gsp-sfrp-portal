import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * LOCAL PREVIEW ONLY. Logs you in as a fake user with chosen roles so you can see the portal
 * before Discord is set up. Disabled automatically in production builds.
 */
export async function POST(req: NextRequest) {
  if (!env.devLogin) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const as = ["public", "employee", "command", "psb", "all", "ootc", "press"].includes(String(form.get("as"))) ? String(form.get("as")) : "public";
  const next = String(form.get("next") || "/portal");

  const jwt = await createSessionToken({
    uid: "100000000000000001",
    username: `preview_${as}`,
    displayName: `Preview (${as})`,
    avatar: null,
    roles: [],
    inGuild: true,
    dev: as,
  });
  const res = NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/portal", req.url), 303);
  res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions);
  return res;
}
