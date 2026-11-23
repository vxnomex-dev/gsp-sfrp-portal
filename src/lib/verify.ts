import "server-only";
import { env } from "./env";
import { getConfig } from "./config";
import { addMemberRole, editInteractionResponse, fetchGuildRoles, postChannelMessage } from "./discord-bot";
import { IS_COMPONENTS_V2, banner, container, divider, text, type Component } from "./components";

/**
 * Verification through Dock API v2 (https://docs.docksys.xyz/api-reference/v2).
 *  1. Member presses Verify → we create a hosted Dock session and privately show "Verification Required"
 *     with the session ID, when it expires and a "Verify Now" link.
 *  2. We long-poll the session. When Dock reports it completed, the member gets the Civilian role and the
 *     same private message turns into "Verification Complete" with their Roblox avatar.
 *  3. "I've verified" checks once more, in case our wait runs out (or the server stops it) before they finish.
 */

export const VERIFY_ID = "fhp_verify";
export const VERIFY_CHECK_PREFIX = "fhp_verify_check:";

const DOCK_API = "https://api.docksys.xyz";

type SessionStatus = "pending" | "completed" | "expired" | "cancelled";
type DockSession = {
  id: string;
  status: SessionStatus;
  statusReason?: string | null;
  expiresAt: string;
  verifyUrl: string;
  result?: { discordId?: string | null; robloxId?: string | null } | null;
};
type Member = { user: { id: string }; roles: string[] };

class DockError extends Error {}

async function dock<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${DOCK_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.dock.apiKey}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const raw = await res.text();
  if (!res.ok) throw new DockError(`Dock ${res.status}: ${raw.slice(0, 300)}`);
  return (JSON.parse(raw) as { data: T }).data;
}

const createSession = (discordId: string, guildId: string) =>
  dock<DockSession>("/v2/sessions", { method: "POST", body: { pid: env.dock.pid, clientId: discordId, guildId } });

const readSession = (id: string, wait = 0) => dock<DockSession>(`/v2/sessions/${encodeURIComponent(id)}?wait=${wait}`);

/* ---------------- Messages ---------------- */

// The deferred reply is already private; edits only add the Components V2 flag
const reply = (components: Component[]) => ({ flags: IS_COMPONENTS_V2, components });
const simple = (title: string, body: string, extra: Component[] = []) =>
  reply([container([text(`## ${title}\n${body}`), ...extra], false)]);

function requiredMessage(s: DockSession, withCheck: boolean, note?: string) {
  const expires = Math.floor(new Date(s.expiresAt).getTime() / 1000);
  return reply([
    container(
      [
        text(
          "## Verification Required\n" +
            "Connect your Roblox account securely through Dock to unlock Florida Highway Patrol.\n\n" +
            `**Session ID:** \`${s.id}\`\n**Expires:** <t:${expires}:R>` +
            (note ? `\n\n-# ${note}` : ""),
        ),
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Verify Now", url: s.verifyUrl },
            ...(withCheck ? [{ type: 2, style: 2, label: "I've verified", custom_id: `${VERIFY_CHECK_PREFIX}${s.id}` }] : []),
          ],
        },
      ],
      false,
    ),
  ]);
}

async function robloxProfile(robloxId: string) {
  const [user, thumb] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${robloxId}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{ name?: string; displayName?: string } | null>,
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=420x420&format=Png&isCircular=false`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{ data?: { imageUrl?: string; state?: string }[] } | null>,
  ]);
  const img = thumb?.data?.[0];
  return { name: user?.name ?? null, avatar: img?.state === "Completed" ? (img.imageUrl ?? null) : null };
}

async function completeMessage(robloxId: string) {
  const p = await robloxProfile(robloxId);
  const body =
    "## Verification Complete\n" +
    `Your Roblox account${p.name ? ` **${p.name}**` : ""} is verified and you now have access to Florida Highway Patrol.`;
  const top: Component = p.avatar
    ? { type: 9, components: [text(body)], accessory: { type: 11, media: { url: p.avatar } } }
    : text(body);
  return reply([container([top, banner()], false)]);
}

/* ---------------- Role ---------------- */

/** The Civilian (verified) slot, else a role called "Civilian", else Community Member. */
async function civilianRole(): Promise<string | null> {
  const cfg = await getConfig();
  if (cfg.roles.civilian) return cfg.roles.civilian;
  const roles = await fetchGuildRoles().catch(() => []);
  const named = roles.find((r) => r.name.replace(/^@/, "").trim().toLowerCase() === "civilian");
  return named?.id ?? (cfg.roles.communityMember || null);
}

/** Session finished: give the role and show the result. Returns true once the session is no longer pending. */
async function settle(token: string, member: Member, s: DockSession): Promise<boolean> {
  if (s.status === "pending") return false;
  if (s.status === "expired" || s.status === "cancelled") {
    await editInteractionResponse(
      token,
      simple(
        s.status === "expired" ? "Verification Expired" : "Verification Cancelled",
        "That verification link is no longer valid. Press **Verify** on the panel to get a new one.",
      ),
    );
    return true;
  }
  const robloxId = s.result?.robloxId;
  const discordId = s.result?.discordId;
  if (!robloxId || (discordId && discordId !== member.user.id)) {
    await editInteractionResponse(token, simple("Verification Failed", "Dock didn't return a Roblox account for you. Please try again."));
    return true;
  }
  const role = await civilianRole();
  try {
    if (!role) throw new Error("no civilian role");
    await addMemberRole(member.user.id, role);
  } catch (e) {
    console.error("[verify] role failed", e);
    await editInteractionResponse(
      token,
      simple("Almost there", "Your Roblox account is linked, but I couldn't give you the Civilian role. Please let staff know."),
    );
    return true;
  }
  await editInteractionResponse(token, await completeMessage(robloxId));
  return true;
}

/* ---------------- Flow ---------------- */

/** Verify / /verify pressed (response already deferred privately). Runs in the background for up to ~4.5 minutes. */
export async function runVerify(token: string, member: Member) {
  const cfg = await getConfig();
  if (!cfg.guildId || !env.dock.apiKey || !env.dock.pid) {
    return editInteractionResponse(token, simple("Verification Unavailable", "Verification isn't connected to Dock yet. Please let staff know."));
  }
  const role = await civilianRole();
  if (role && member.roles.includes(role)) {
    return editInteractionResponse(token, simple("Already Verified", "You're already verified and have access to Florida Highway Patrol."));
  }

  let session: DockSession;
  try {
    session = await createSession(member.user.id, cfg.guildId);
  } catch (e) {
    console.error("[verify] create session failed", e);
    return editInteractionResponse(token, simple("Verification Unavailable", "I couldn't reach Dock just now. Please try again in a minute."));
  }
  if (await settle(token, member, session)) return;
  await editInteractionResponse(token, requiredMessage(session, true));

  // Long-poll Dock until the session ends, it expires, or we run out of time (the function can run ~5 minutes)
  const stopAt = Math.min(Date.now() + 270_000, new Date(session.expiresAt).getTime() + 5_000);
  while (Date.now() < stopAt) {
    const wait = Math.max(1, Math.min(25, Math.floor((stopAt - Date.now()) / 1000)));
    try {
      session = await readSession(session.id, wait);
    } catch (e) {
      console.error("[verify] poll failed", e);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (await settle(token, member, session)) return;
  }
  // Still pending after our wait: if the link has expired, say so; otherwise "I've verified" stays available
  if (new Date(session.expiresAt).getTime() <= Date.now()) await settle(token, member, { ...session, status: "expired" });
}

/** "I've verified" pressed on an older message (response deferred as an update). */
export async function checkVerify(token: string, member: Member, sessionId: string) {
  if (!env.dock.apiKey) return;
  try {
    const s = await readSession(sessionId, 5);
    if (!(await settle(token, member, s))) {
      await editInteractionResponse(token, requiredMessage(s, true, "Dock hasn't confirmed it yet. Finish the steps on Dock, then press I've verified."));
    }
  } catch (e) {
    console.error("[verify] check failed", e);
    await editInteractionResponse(token, simple("Verification Expired", "Press **Verify** on the panel to get a new link."));
  }
}

/* ---------------- Panel ---------------- */

export function verifyPanel() {
  return [
    container([
      divider(),
      text(
        "## Verification\n" +
          "Welcome to **Florida Highway Patrol**. Before you can see the rest of the server, link your Roblox account so we know who you are in-game.\n\n" +
          "Press **Verify** below and follow the link to connect your Roblox account securely through Dock. You'll get access as soon as you're done.",
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
