import "server-only";
import { createPublicKey, verify } from "node:crypto";
import { env } from "./env";
import { IS_COMPONENTS_V2, type Component } from "./components";

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
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bot ${env.discord.botToken}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text());
  return (res.status === 204 ? null : await res.json()) as T;
}

/**
 * The channel the applications webhook posts into. Read from the webhook itself, so no extra setting is
 * needed (APPLICATIONS_CHANNEL_ID overrides it).
 */
let cachedAppChannel: string | null = null;
export async function getApplicationsChannelId(): Promise<string | null> {
  if (env.applicationsChannelId) return env.applicationsChannelId;
  if (cachedAppChannel) return cachedAppChannel;
  if (!env.webhooks.applications) return null;
  try {
    const res = await fetch(env.webhooks.applications, { cache: "no-store" });
    if (!res.ok) return null;
    cachedAppChannel = ((await res.json()) as { channel_id: string }).channel_id;
    return cachedAppChannel;
  } catch {
    return null;
  }
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

/** DMs a Components V2 message. Returns false if the user has DMs closed or doesn't share a server with the bot. */
export async function sendDirectMessageV2(userId: string, components: Component[]): Promise<boolean> {
  try {
    const dm = await bot<{ id: string }>(`/users/@me/channels`, { method: "POST", body: { recipient_id: userId } });
    await postChannelMessage(dm.id, { components });
    return true;
  } catch (e) {
    console.error("[dm] failed", e);
    return false;
  }
}

/* ---------------- Channels & commands (support tickets) ---------------- */

export type Overwrite = { id: string; type: 0 | 1; allow?: string; deny?: string };

export function createGuildTextChannel(opts: { name: string; parentId: string; overwrites: Overwrite[]; topic?: string }) {
  return bot<{ id: string; name: string }>(`/guilds/${env.discord.guildId}/channels`, {
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

export function deleteChannel(channelId: string) {
  return bot(`/channels/${channelId}`, { method: "DELETE" });
}

/** Registers (or updates) the bot's slash commands in the server. Safe to run any number of times. */
export function registerGuildCommands(commands: unknown[]) {
  return bot<unknown[]>(`/applications/${env.discord.clientId}/guilds/${env.discord.guildId}/commands`, {
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
