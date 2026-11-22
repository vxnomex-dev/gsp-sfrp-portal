import "server-only";
import { createPublicKey, verify } from "node:crypto";
import { env } from "./env";
import { IS_COMPONENTS_V2, type Component } from "./components";
import { getConfig, guildId } from "./config";

// DISCORD_API_BASE is only for local testing against a mock server.
const API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";

export class DiscordError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Discord API ${status}: ${body.slice(0, 300)}`);
  }
}

async function bot<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.discord.botToken) throw new DiscordError(0, "DISCORD_BOT_TOKEN is not set");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bot ${env.discord.botToken}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    // Rate limited: wait as long as Discord asks (up to 3 tries, max 10s each), then try again
    if (res.status === 429 && attempt < 3) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const wait = Math.min(Number(body.retry_after ?? res.headers.get("retry-after") ?? 1), 10);
      await new Promise((r) => setTimeout(r, Math.ceil(wait * 1000) + 150));
      continue;
    }
    if (!res.ok) throw new DiscordError(res.status, await res.text());
    return (res.status === 204 ? null : await res.json()) as T;
  }
}

/** The channel cadet applications are posted in (Portal → Discord Setup). */
export async function getApplicationsChannelId(): Promise<string | null> {
  return (await getConfig()).channels.applications || null;
}

export type V2Message = {
  components: Component[];
  allowed_mentions?: { parse: string[]; roles?: string[]; users?: string[] };
};

export function postChannelMessage(channelId: string, msg: V2Message) {
  return bot<{ id: string; channel_id: string }>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: { flags: IS_COMPONENTS_V2, allowed_mentions: { parse: [] }, ...msg },
  });
}

export function editChannelMessage(channelId: string, messageId: string, msg: V2Message) {
  return bot(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: { allowed_mentions: { parse: [] }, ...msg },
  });
}

export type FileUpload = { name: string; data: string; contentType: string };

/** Posts a Components V2 message with a file attached (reference it with a File component: attachment://name). */
export async function postChannelMessageWithFile(channelId: string, msg: V2Message, file: FileUpload) {
  if (!env.discord.botToken) throw new DiscordError(0, "DISCORD_BOT_TOKEN is not set");
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      flags: IS_COMPONENTS_V2,
      allowed_mentions: { parse: [] },
      ...msg,
      attachments: [{ id: 0, filename: file.name }],
    }),
  );
  form.append("files[0]", new Blob([file.data], { type: file.contentType }), file.name);
  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${env.discord.botToken}` },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text());
  return (await res.json()) as { id: string };
}

export type DiscordMessage = {
  id: string;
  type: number;
  content: string;
  timestamp: string;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  attachments?: { filename: string; url: string; content_type?: string }[];
  embeds?: { title?: string; description?: string }[];
  components?: Record<string, unknown>[];
};

/** Every message in a channel, oldest first (stops at `max`). Needs the Message Content intent to see message text. */
export async function fetchAllMessages(channelId: string, max = 2000): Promise<DiscordMessage[]> {
  const all: DiscordMessage[] = [];
  let before: string | undefined;
  while (all.length < max) {
    const page = await bot<DiscordMessage[]>(
      `/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ""}`,
    );
    all.push(...page);
    if (page.length < 100) break;
    before = page[page.length - 1].id;
  }
  return all.reverse();
}

/** DMs a Components V2 message. Returns false if the user has DMs closed or doesn't share a server with the bot. */
export async function sendDirectMessageV2(userId: string, components: Component[], file?: FileUpload): Promise<boolean> {
  try {
    const dm = await bot<{ id: string }>(`/users/@me/channels`, { method: "POST", body: { recipient_id: userId } });
    if (file) await postChannelMessageWithFile(dm.id, { components }, file);
    else await postChannelMessage(dm.id, { components });
    return true;
  } catch (e) {
    console.error("[dm] failed", e);
    return false;
  }
}

/* ---------------- Channels & commands (support tickets) ---------------- */

export type Overwrite = { id: string; type: 0 | 1; allow?: string; deny?: string };

export async function createGuildTextChannel(opts: { name: string; parentId: string; overwrites: Overwrite[]; topic?: string }) {
  return bot<{ id: string; name: string }>(`/guilds/${await guildId()}/channels`, {
    method: "POST",
    body: {
      name: opts.name,
      type: 0,
      parent_id: opts.parentId,
      topic: opts.topic,
      permission_overwrites: opts.overwrites.map((o) => ({ allow: "0", deny: "0", ...o })),
    },
  });
}

export function renameChannel(channelId: string, name: string) {
  return bot<{ id: string; name: string }>(`/channels/${channelId}`, { method: "PATCH", body: { name } });
}

export function deleteChannel(channelId: string) {
  return bot(`/channels/${channelId}`, { method: "DELETE" });
}

/** Registers (or updates) the bot's slash commands in the server. Safe to run any number of times. */
export async function registerGuildCommands(commands: unknown[]) {
  return bot<unknown[]>(`/applications/${env.discord.clientId}/guilds/${await guildId()}/commands`, {
    method: "PUT",
    body: commands,
  });
}

/** Posts a follow-up message to an interaction (can be Components V2 and/or ephemeral). */
export async function interactionFollowup(interactionToken: string, msg: V2Message & { flags?: number }) {
  const res = await fetch(`${API}/webhooks/${env.discord.clientId}/${interactionToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...msg }),
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text());
}

/** Replaces the interaction's original response (e.g. the "Opening your ticket…" loading message). */
export async function editInteractionResponse(interactionToken: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/webhooks/${env.discord.clientId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...body }),
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text());
}

/* ---------------- Members & roles (roster) ---------------- */

export type GuildRole = { id: string; name: string; position: number; color: number; managed?: boolean };
export type GuildMember = {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null;
  roles: string[];
};

export async function fetchGuildRoles() {
  return bot<GuildRole[]>(`/guilds/${await guildId()}/roles`);
}

/** Every member of the server. Needs the Server Members intent (Developer Portal → Bot). */
export async function fetchGuildMembers(): Promise<GuildMember[]> {
  const all: GuildMember[] = [];
  let after = "0";
  for (let i = 0; i < 20; i++) {
    const page = await bot<GuildMember[]>(`/guilds/${await guildId()}/members?limit=1000&after=${after}`);
    all.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  return all;
}

export async function fetchGuildMember(userId: string) {
  return bot<GuildMember>(`/guilds/${await guildId()}/members/${userId}`);
}

export async function addMemberRole(userId: string, roleId: string) {
  return bot(`/guilds/${await guildId()}/members/${userId}/roles/${roleId}`, { method: "PUT" });
}

export async function removeMemberRole(userId: string, roleId: string) {
  return bot(`/guilds/${await guildId()}/members/${userId}/roles/${roleId}`, { method: "DELETE" });
}

/** Starts a public thread on a message (used for infraction evidence). */
export function startThreadFromMessage(channelId: string, messageId: string, name: string) {
  return bot<{ id: string }>(`/channels/${channelId}/messages/${messageId}/threads`, {
    method: "POST",
    body: { name: name.slice(0, 100), auto_archive_duration: 10080 },
  });
}

/** Sets a member's server nickname. Retries once if Discord rate-limits us. */
export async function setNickname(userId: string, nick: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await bot(`/guilds/${await guildId()}/members/${userId}`, { method: "PATCH", body: { nick } });
      return;
    } catch (e) {
      if (e instanceof DiscordError && e.status === 429) {
        const wait = Number(JSON.parse(e.body || "{}").retry_after ?? 1);
        await new Promise((r) => setTimeout(r, Math.ceil(wait * 1000) + 100));
        continue;
      }
      throw e;
    }
  }
  throw new DiscordError(429, "rate limited");
}

/* ---------------- Interactions (button clicks) ---------------- */

/** Verifies that a request really came from Discord (Ed25519 signature). */
export function verifyDiscordRequest(signature: string | null, timestamp: string | null, body: string): boolean {
  if (!signature || !timestamp || !env.discord.publicKey) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(env.discord.publicKey, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/** Edits the message a button was clicked on, after a deferred update. */
export async function editInteractionOriginal(interactionToken: string, msg: V2Message) {
  const res = await fetch(`${API}/webhooks/${env.discord.clientId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...msg }),
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text());
}

/** Sends a private ("only you can see this") follow-up message to whoever clicked the button. */
export async function ephemeralFollowup(interactionToken: string, content: string) {
  await fetch(`${API}/webhooks/${env.discord.clientId}/${interactionToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, flags: 64, allowed_mentions: { parse: [] } }),
  }).catch(() => {});
}

/* ---------------- Server setup (Portal → Discord Setup) ---------------- */

export type BotGuild = { id: string; name: string; icon: string | null };
export type GuildChannel = { id: string; name: string; type: number; position: number; parent_id: string | null };

/** Every server the bot is in. */
export function listBotGuilds() {
  return bot<BotGuild[]>(`/users/@me/guilds?limit=200`);
}

/** Makes the bot leave a server. */
export function leaveGuild(id: string) {
  return bot(`/users/@me/guilds/${id}`, { method: "DELETE" });
}

export function fetchRolesOf(id: string) {
  return bot<(GuildRole & { permissions: string })[]>(`/guilds/${id}/roles`);
}

export function fetchChannelsOf(id: string) {
  return bot<GuildChannel[]>(`/guilds/${id}/channels`);
}

export function fetchGuildInfo(id: string) {
  return bot<{ id: string; name: string; owner_id: string; icon: string | null }>(`/guilds/${id}`);
}

/** The Discord account that owns the bot application (plus team members). */
let ownerCache: { at: number; ids: string[] } | null = null;
export async function botOwnerIds(): Promise<string[]> {
  if (ownerCache && Date.now() - ownerCache.at < 3_600_000) return ownerCache.ids;
  const app = await bot<{ owner?: { id: string }; team?: { members: { user: { id: string } }[] } | null }>(
    `/oauth2/applications/@me`,
  );
  const ids = [app.owner?.id, ...(app.team?.members.map((m) => m.user.id) ?? [])].filter((x): x is string => !!x);
  ownerCache = { at: Date.now(), ids };
  return ids;
}
