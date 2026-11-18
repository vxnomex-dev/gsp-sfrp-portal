import "server-only";
import { env } from "./env";

const API = "https://discord.com/api/v10";

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export function avatarUrl(id: string, avatar: string | null | undefined) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`;
  const idx = Number((BigInt(id) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.discord.clientId,
    response_type: "code",
    redirect_uri: `${env.baseUrl}/api/auth/callback`,
    scope: "identify",
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.discord.clientId,
      client_secret: env.discord.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.baseUrl}/api/auth/callback`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord user lookup failed (${res.status})`);
  return (await res.json()) as DiscordUser;
}

/**
 * Looks up a member's roles in the South Fulton Roleplay server using the BOT token.
 * Returns null if the user is not in the server, or undefined if the bot isn't configured.
 * Results are cached for 60 seconds so role changes in Discord show up on the site within a minute.
 */
const memberCache = new Map<string, { at: number; roles: string[] | null }>();

export async function fetchMemberRoles(
  userId: string,
  { fresh = false } = {},
): Promise<string[] | null | undefined> {
  // undefined = bot not configured, null = not in the server
  if (!env.discord.botToken || !env.discord.guildId) return undefined;
  const cached = memberCache.get(userId);
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.roles;

  const res = await fetch(`${API}/guilds/${env.discord.guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${env.discord.botToken}` },
    cache: "no-store",
  });
  let roles: string[] | null;
  if (res.status === 404) roles = null;
  else if (!res.ok) {
    // Discord hiccup / rate limit: keep the last known value instead of locking people out.
    if (cached) return cached.roles;
    throw new Error(`Discord member lookup failed (${res.status})`);
  } else roles = ((await res.json()) as { roles: string[] }).roles;

  memberCache.set(userId, { at: Date.now(), roles });
  return roles;
}
