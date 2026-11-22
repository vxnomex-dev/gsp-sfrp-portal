import "server-only";
import { getConfig } from "./config";
import { botOwnerIds, fetchGuildInfo, fetchRolesOf } from "./discord-bot";

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

let guildCache: { at: number; id: string; ownerId: string; perms: Map<string, bigint> } | null = null;

async function guildPerms(id: string) {
  if (guildCache && guildCache.id === id && Date.now() - guildCache.at < 300_000) return guildCache;
  const [info, roles] = await Promise.all([fetchGuildInfo(id), fetchRolesOf(id)]);
  guildCache = { at: Date.now(), id, ownerId: info.owner_id, perms: new Map(roles.map((r) => [r.id, BigInt(r.permissions)])) };
  return guildCache;
}

/**
 * "owner": owns the bot application — always has full access, so the site can be set up on a new server.
 * "admin": Administrator / Manage Server (or server owner) in the chosen server — can open Discord Setup.
 */
export async function setupAccess(uid: string, roleIds: string[]): Promise<"owner" | "admin" | null> {
  try {
    if ((await botOwnerIds()).includes(uid)) return "owner";
  } catch {
    /* bot token missing / Discord down */
  }
  try {
    const id = (await getConfig()).guildId;
    if (!id) return null;
    const g = await guildPerms(id);
    if (g.ownerId === uid) return "admin";
    let p = g.perms.get(id) ?? BigInt(0); // @everyone
    for (const r of roleIds) p |= g.perms.get(r) ?? BigInt(0);
    return (p & ADMINISTRATOR) || (p & MANAGE_GUILD) ? "admin" : null;
  } catch {
    return null;
  }
}
