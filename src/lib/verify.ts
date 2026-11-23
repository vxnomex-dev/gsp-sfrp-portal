import "server-only";
import { env } from "./env";
import { getConfig } from "./config";
import { addMemberRole, fetchGuildRoles, postChannelMessage } from "./discord-bot";
import { container, divider, text } from "./components";

/**
 * Verification through Dock (https://docksys.xyz).
 * Members press Verify on the panel; we ask Dock which Roblox account their Discord is linked to and,
 * if there is one, give them the Civilian role. If not, they get a link to verify with Dock and a
 * "Check again" button.
 */

export const VERIFY_ID = "fhp_verify";
export const VERIFY_RECHECK_ID = "fhp_verify_recheck";

const DOCK_API = "https://api.docksys.xyz";

export type RobloxLink = { id: string; username: string | null };

/** Finds the Roblox account in Dock's reply, whatever shape it comes in. */
function readLink(body: unknown): RobloxLink | null {
  const seen = new Set<unknown>();
  const walk = (o: unknown): RobloxLink | null => {
    if (!o || typeof o !== "object" || seen.has(o)) return null;
    seen.add(o);
    const r = o as Record<string, unknown>;
    const id = r.robloxId ?? r.roblox_id ?? r.robloxID ?? r.robloxUserId ?? r.userId;
    if (id !== undefined && id !== null && String(id).match(/^\d+$/)) {
      const name = r.robloxUsername ?? r.roblox_username ?? r.username ?? r.name ?? r.displayName ?? null;
      return { id: String(id), username: name ? String(name) : null };
    }
    for (const k of ["data", "roblox", "result", "user", "account"]) {
      const hit = walk(r[k]);
      if (hit) return hit;
    }
    return null;
  };
  return walk(body);
}

/** Asks Dock which Roblox account a Discord member is linked to. null = not linked. */
export async function dockLookup(discordId: string, guildId: string): Promise<RobloxLink | null> {
  if (!env.dock.apiKey) throw new Error("DOCK_API_KEY is not set");
  const url = `${DOCK_API}/api/v1/public/discord-to-roblox?discordId=${encodeURIComponent(discordId)}&guildId=${encodeURIComponent(guildId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.dock.apiKey}` }, cache: "no-store" });
  if (res.status === 404) return null;
  const raw = await res.text();
  if (!res.ok) throw new Error(`Dock ${res.status}: ${raw.slice(0, 200)}`);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`Dock sent something unexpected: ${raw.slice(0, 200)}`);
  }
  const link = readLink(body);
  if (!link) console.log("[verify] Dock found no link", raw.slice(0, 300));
  return link;
}

/** The role verified members get: the Civilian slot, else a role called "Civilian", else Community Member. */
async function civilianRole(): Promise<string | null> {
  const cfg = await getConfig();
  if (cfg.roles.civilian) return cfg.roles.civilian;
  const roles = await fetchGuildRoles().catch(() => []);
  const named = roles.find((r) => r.name.replace(/^@/, "").trim().toLowerCase() === "civilian");
  return named?.id ?? (cfg.roles.communityMember || null);
}

/* ---------------- Panel ---------------- */

export function verifyPanel() {
  return [
    container([
      divider(),
      text(
        "## Verification\n" +
          "Welcome to **Florida State Roleplay**. Before you can see the rest of the server, link your Roblox account so we know who you are in-game.\n\n" +
          "Press **Verify** below. If your Roblox account is already linked with Dock you'll get access straight away — if not, we'll show you how to link it.",
      ),
      { type: 1, components: [{ type: 2, style: 2, label: "Verify", custom_id: VERIFY_ID }] },
      divider(),
    ]),
  ];
}

export async function postVerifyPanel(channelId: string) {
  try {
    await postChannelMessage(channelId, { components: verifyPanel() });
    return "Verification panel posted.";
  } catch (e) {
    console.error("[verify] panel post failed", e);
    return "I couldn't post here — make sure I can View Channel and Send Messages in this channel.";
  }
}

/* ---------------- Button ---------------- */

type Reply = { content: string; components?: unknown[] };

const notLinkedReply = (): Reply => ({
  content:
    "You haven't linked a Roblox account with **Dock** yet.\n\n" +
    "1. Press **Verify with Dock** and sign in with Roblox.\n" +
    "2. Come back and press **Check again**.",
  components: [
    {
      type: 1,
      components: [
        { type: 2, style: 5, label: "Verify with Dock", url: env.dock.verifyUrl },
        { type: 2, style: 2, label: "Check again", custom_id: VERIFY_RECHECK_ID },
      ],
    },
  ],
});

/** Runs after the button press has been deferred. Returns what to show the member. */
export async function runVerify(member: { user: { id: string }; roles: string[] }): Promise<Reply> {
  const cfg = await getConfig();
  if (!cfg.guildId) return { content: "Verification isn't set up yet. Please let staff know." };
  if (!env.dock.apiKey) return { content: "Verification isn't connected to Dock yet. Please let staff know." };

  let link: RobloxLink | null;
  try {
    link = await dockLookup(member.user.id, cfg.guildId);
  } catch (e) {
    console.error("[verify] Dock lookup failed", e);
    return { content: "I couldn't reach Dock just now. Please try again in a minute." };
  }
  if (!link) return notLinkedReply();

  const role = await civilianRole();
  if (!role) return { content: "You're linked, but no Civilian role is set up yet. Please let staff know." };

  const who = link.username ? `**${link.username}**` : `Roblox ID ${link.id}`;
  if (member.roles.includes(role)) return { content: `You're already verified as ${who}.`, components: [] };

  try {
    await addMemberRole(member.user.id, role);
  } catch (e) {
    console.error("[verify] role failed", e);
    return { content: "You're linked, but I couldn't give you the role. Please let staff know (my role may be below it)." };
  }
  return { content: `You're verified as ${who}. Welcome to Florida State Roleplay!`, components: [] };
}

export const VERIFY_COMMANDS = [
  {
    name: "verify-panel",
    description: "Post the verification panel in this channel",
    type: 1,
    contexts: [0],
    default_member_permissions: String(2 ** 5), // Manage Server
  },
  {
    name: "verify",
    description: "Verify your Roblox account and get access to the server",
    type: 1,
    contexts: [0],
  },
];
