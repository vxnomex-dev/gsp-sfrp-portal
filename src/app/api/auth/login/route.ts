import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/discord";
import { discordConfigured, env } from "@/lib/env";

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/portal";
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  if (!discordConfigured()) {
    if (env.devLogin) return NextResponse.redirect(new URL(`/dev-login?next=${encodeURIComponent(next)}`, req.url));
    return new NextResponse(
      "Discord login is not configured yet. Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and SESSION_SECRET (see README).",
      { status: 503 },
    );
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("gsp_oauth_state", state, opts);
  res.cookies.set("gsp_oauth_next", next, opts);
  return res;
}
