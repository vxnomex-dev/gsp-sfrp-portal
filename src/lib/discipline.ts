import { fmtCallsign } from "./callsign";
import "server-only";
import { query, queryOne } from "./db";
import { site } from "./site";
import { clean, container, divider, quote, text, unix, type Component } from "./components";
import {
  DiscordError,
  addMemberRole,
  editChannelMessage,
  editInteractionResponse,
  fetchGuildMember,
  fetchGuildRoles,
  postChannelMessage,
  removeMemberRole,
  sendDirectMessageV2,
  setNickname,
  startThreadFromMessage,
} from "./discord-bot";
import { assignCallsignForMember, baseName, invalidateRosterCache, releaseCallsign } from "./roster";
import type { Member } from "./tickets";
import { getConfig, rolesFor } from "./config";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Channels and roles come from Portal → Discord Setup:
 *  - /promote: Office of the Colonel, High Command, Command
 *  - /infraction: Human Resources, Office of the Colonel
 *  - Termination keeps only the Community Member role.
 */
/** The State Blacklist role: the Discord Setup slot, else a role named "State Blacklist". */
export async function blacklistRoleId(): Promise<string | null> {
  const cfg = await getConfig();
  if (cfg.roles.blacklist) return cfg.roles.blacklist;
  const roles = await fetchGuildRoles().catch(() => []);
  return roles.find((r) => /state\s*blacklist/i.test(r.name))?.id ?? null;
}

async function disciplineConfig() {
  const cfg = await getConfig();
  return {
    promotionsChannelId: cfg.channels.promotions,
    infractionsChannelId: cfg.channels.infractions,
    promoteRoles: rolesFor(cfg, "ootc", "highCommand", "command"),
    infractRoles: rolesFor(cfg, "hr", "ootc"),
    communityMemberRoleIds: rolesFor(cfg, "communityMember"),
    civilianRoleIds: rolesFor(cfg, "civilian"),
  };
}

export const INFRACTION_TYPES = {
  termination: "Termination",
  strike: "Strike",
  warning: "Warning",
  inactivity: "Inactivity Notice",
  suspension: "Suspension",
  demotion: "Demotion",
  blacklist: "Blacklist",
} as const;
export type InfractionKind = keyof typeof INFRACTION_TYPES;

export const SUSPENSION_MODAL_PREFIX = "gsp_inf_susp:";

const hasAny = (m: Member, ids: string[]) => m.roles.some((r) => ids.includes(r));
export const canPromote = async (m: Member) => hasAny(m, (await disciplineConfig()).promoteRoles);
export const canInfract = async (m: Member) => hasAny(m, (await disciplineConfig()).infractRoles);

const displayName = (m: Member) => m.nick || m.user.global_name || m.user.username;
const caseRef = (id: number) => `Case #${id}`;

function explain(e: unknown) {
  if (e instanceof DiscordError && e.status === 403) {
    return "Missing permissions — the bot needs Manage Roles / Manage Nicknames and its role must be above this member's roles.";
  }
  if (e instanceof DiscordError && e.status === 404) return "That member isn't in the server.";
  return (e as Error).message.slice(0, 200);
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

/** "𝐆𝐒𝐏 | Captain" → "Captain" (falls back to a role mention if the name is unknown). */
function roleLabel(roleId: string, names: Map<string, string>) {
  const n = names.get(roleId);
  if (!n) return `<@&${roleId}>`;
  return n.normalize("NFKC").replace(/^\s*(?:FHP|GSP)\s*[|│¦:\-–—]\s*/i, "").trim() || n;
}

function promotionMessage(p: {
  id: number;
  userId: string;
  oldRank: string;
  newRank: string;
  callsign: number | null;
  reason: string;
  issuerId: string;
  at: Date;
}): Component[] {
  const t = unix(p.at);
  return [
    container([
      text(`> <@${p.userId}> has been promoted to **${clean(p.newRank, 60)}** on <t:${t}:D> at <t:${t}:t>.`),
      text(
        `**Previous Rank:** ${clean(p.oldRank, 60)}\n` +
          `**New Rank:** ${clean(p.newRank, 60)}\n` +
          `**Callsign:** ${p.callsign !== null ? fmtCallsign(p.callsign) : "Unassigned"}\n` +
          `**Reason:** ${clean(p.reason, 800)}`,
      ),
      text(
        `-# Congratulations, and thank you for your continued service to the Florida Highway Patrol.\n` +
          `-# ID: ${p.id} | Promoted by: <@${p.issuerId}>`,
      ),
      divider(),
    ]),
  ];
}

/** Runs after Discord has been told to wait. Swaps the rank roles, moves the callsign and posts the announcement. */
export async function runPromotion(opts: {
  token: string;
  commandChannelId: string;
  issuer: Member;
  userId: string;
  oldRoleId: string;
  newRoleId: string;
  reason: string;
}) {
  const { token, issuer, userId, oldRoleId, newRoleId, reason } = opts;
  const problems: string[] = [];
  try {
    const member = await fetchGuildMember(userId);

    // Roles: add the new rank, remove the old rank
    try {
      await addMemberRole(userId, newRoleId);
    } catch (e) {
      await editInteractionResponse(token, { content: `Couldn't give <@&${newRoleId}>: ${explain(e)}` });
      return;
    }
    if (member.roles.includes(oldRoleId)) {
      await removeMemberRole(userId, oldRoleId).catch((e) => problems.push(`Couldn't remove <@&${oldRoleId}>: ${explain(e)}`));
    } else {
      problems.push(`They didn't have <@&${oldRoleId}>, so nothing was removed.`);
    }

    // Callsign: lowest free number in the new rank's block, then update the nickname
    const { old: oldCallsign, next: newCallsign, rank: rankLabel, full, nickError, paused } = await assignCallsignForMember(userId);
    if (paused) problems.push("Callsigns are paused until the FHP ranks are set up, so no callsign was given.");
    else if (full) problems.push(`All ${rankLabel} callsigns are taken, so they have no callsign until a spot opens.`);
    else if (!rankLabel) problems.push("Their new role isn't recognised as a rank, so no callsign was given.");
    if (nickError) problems.push(`Nickname not updated: ${nickError}`);
    invalidateRosterCache();

    // Record it first so the announcement can show its ID
    const rec = (await queryOne<{ id: number; created_at: string | Date }>(
      `INSERT INTO promotions (user_id, old_role_id, new_role_id, reason, old_callsign, new_callsign, issuer_id, issuer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
      [userId, oldRoleId, newRoleId, reason, oldCallsign, newCallsign, issuer.user.id, displayName(issuer)],
    ))!;
    const names = new Map((await fetchGuildRoles().catch(() => [])).map((r) => [r.id, r.name]));

    // Announcement
    const channelId = (await disciplineConfig()).promotionsChannelId || opts.commandChannelId;
    const msg = await postChannelMessage(channelId, {
      components: promotionMessage({
        id: rec.id,
        userId,
        oldRank: roleLabel(oldRoleId, names),
        newRank: roleLabel(newRoleId, names),
        callsign: newCallsign,
        reason,
        issuerId: issuer.user.id,
        at: new Date(rec.created_at),
      }),
      allowed_mentions: { parse: [], users: [userId] },
    });
    await query(`UPDATE promotions SET channel_id=$1, message_id=$2 WHERE id=$3`, [msg.channel_id, msg.id, rec.id]);

    await editInteractionResponse(token, {
      content:
        `Promoted <@${userId}> to <@&${newRoleId}>` +
        (newCallsign !== null ? ` — callsign \`${fmtCallsign(newCallsign)}\`${oldCallsign !== null && oldCallsign !== newCallsign ? ` (was \`${fmtCallsign(oldCallsign)}\`)` : ""}` : "") +
        `. Posted in <#${msg.channel_id}>.` +
        (problems.length ? `\n${problems.join("\n")}` : ""),
    });
  } catch (e) {
    console.error("[promote] failed", e);
    await editInteractionResponse(token, { content: `Promotion failed: ${explain(e)}` }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Infractions                                                         */
/* ------------------------------------------------------------------ */

type Infraction = {
  id: number;
  user_id: string;
  user_name: string;
  kind: InfractionKind;
  reason: string;
  policy: string | null;
  duration: string | null;
  issuer_id: string;
  issuer_name: string;
  status: "active" | "voided";
  voided_by_id: string | null;
  void_reason: string | null;
  voided_at: string | Date | null;
  removed_roles: string[] | string | null;
  channel_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  created_at: string | Date;
};

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** "has received a **Warning** from **Human Resources** for **Shift Grinding**" */
function infractionSentence(inf: Infraction, subject: string) {
  const type = INFRACTION_TYPES[inf.kind];
  const t = unix(new Date(inf.created_at));
  const verb =
    inf.kind === "termination"
      ? `${subject === "You" ? "have" : "has"} been **terminated** from the Florida Highway Patrol by **Human Resources**`
      : inf.kind === "blacklist"
        ? `${subject === "You" ? "have" : "has"} been **blacklisted** from the Florida Highway Patrol by **Human Resources**`
        : `${subject === "You" ? "have" : "has"} received ${article(type)} **${type}** from **Human Resources**`;
  const forWhat = inf.policy ? ` for **${clean(inf.policy, 100)}**` : "";
  return `> ${subject} ${verb}${forWhat} on <t:${t}:D> at <t:${t}:t>.`;
}

function infractionDetails(inf: Infraction) {
  const lines: string[] = [];
  if (inf.policy) lines.push(`**Policy Broken:** ${clean(inf.policy, 100)}`);
  lines.push(`**${inf.policy ? "Description" : "Reason"}:** ${clean(inf.reason, 1000)}`);
  if (inf.duration) lines.push(`**Duration:** ${clean(inf.duration, 60)}`);
  return lines.join("\n");
}

function voidBlock(inf: Infraction): Component[] {
  if (inf.status !== "voided") return [];
  return [
    divider(),
    text(
      `**Status:** Voided by <@${inf.voided_by_id}>` +
        (inf.voided_at ? ` on <t:${unix(new Date(inf.voided_at))}:D>` : "") +
        (inf.void_reason ? `\n**Void Reason:** ${clean(inf.void_reason, 400)}` : ""),
    ),
  ];
}

function infractionMessage(inf: Infraction): Component[] {
  return [
    container([
      text(infractionSentence(inf, `<@${inf.user_id}>`)),
      text(infractionDetails(inf)),
      ...voidBlock(inf),
      text(
        `-# If you have any questions or concerns, please contact Human Resources.\n` +
          `-# ID: ${inf.id} | Issued by: <@${inf.issuer_id}>`,
      ),
      divider(),
    ]),
  ];
}

function infractionDM(inf: Infraction): Component[] {
  return [
    container([
      text(infractionSentence(inf, "You")),
      text(infractionDetails(inf)),
      text(
        `-# If you believe this was issued in error, open a Command Support ticket in the ${clean(site.community, 60)} Discord.\n` +
          `-# ID: ${inf.id} | Issued by: ${clean(inf.issuer_name, 40)}`,
      ),
      divider(),
    ]),
  ];
}

/**
 * Strips every role except the ones kept (and roles Discord manages itself). Returns the removed role IDs.
 * Termination keeps Community Member; Blacklist keeps only Civilian.
 */
async function stripRoles(userId: string, problems: string[], mode: "termination" | "blacklist" = "termination") {
  const [member, roles, dc] = await Promise.all([fetchGuildMember(userId), fetchGuildRoles(), disciplineConfig()]);
  const byId = new Map(roles.map((r) => [r.id, r]));
  const configured = mode === "blacklist" ? dc.civilianRoleIds : dc.communityMemberRoleIds;
  const pattern = mode === "blacklist" ? /^@?\s*civilian\s*$/i : /community\s*member/i;
  const keepLabel = mode === "blacklist" ? "Civilian" : "Community Member";
  const keep = new Set(configured.length ? configured : roles.filter((r) => pattern.test(r.name)).map((r) => r.id));
  if (!keep.size) problems.push(`No "${keepLabel}" role found — every removable role was taken off.`);
  const removed: string[] = [];
  for (const roleId of member.roles) {
    const role = byId.get(roleId);
    if (keep.has(roleId) || role?.managed) continue;
    try {
      await removeMemberRole(userId, roleId);
      removed.push(roleId);
    } catch (e) {
      problems.push(`Couldn't remove <@&${roleId}>: ${explain(e)}`);
    }
  }
  await releaseCallsign(userId);
  const name = baseName(member);
  if (member.nick && member.nick !== name) await setNickname(userId, name).catch(() => {});
  invalidateRosterCache();
  return removed;
}

/* ------------------------------------------------------------------ */
/* Infraction roles ("Strike 1", "Strike 2", "Warning 1", "Suspended")  */
/* ------------------------------------------------------------------ */

/** Kinds that stack ("Strike 1", "Strike 2"…) and the word their Discord roles use. */
const NUMBERED_ROLES: Partial<Record<InfractionKind, RegExp>> = {
  strike: /strike/i,
  warning: /warn(ing)?/i,
  inactivity: /inactiv(ity|e)/i,
};
const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/** The number in a role name like "Strike 2", "FHP | Strike II" or "2nd Strike". */
function roleNumber(name: string): number | null {
  const n = name.normalize("NFKC").toLowerCase();
  const digit = /(?:^|\D)(\d{1,2})(?:st|nd|rd|th)?(?:\D|$)/.exec(n);
  if (digit) return Number(digit[1]);
  const roman = /\b(x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/.exec(n.replace(/^.*?(strike|warn\w*|inactiv\w*)/, "$1 "));
  if (roman) return ROMAN.indexOf(roman[1]);
  return null;
}

/**
 * Makes the member's infraction roles match their record: e.g. their 2nd active strike → "Strike 2" (and
 * "Strike 1" removed). Suspensions get a "Suspended" role. Runs after issuing and after voiding.
 */
async function syncInfractionRoles(userId: string, kind: InfractionKind, problems: string[]) {
  const pattern = NUMBERED_ROLES[kind];
  const isSuspension = kind === "suspension";
  if (!pattern && !isSuspension) return;
  const [member, roles, count] = await Promise.all([
    fetchGuildMember(userId),
    fetchGuildRoles(),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM infractions WHERE user_id=$1 AND kind=$2 AND status <> 'voided'`, [userId, kind]),
  ]);
  const active = count?.n ?? 0;

  if (isSuspension) {
    const role = roles.find((r) => !r.managed && /suspen(ded|sion)/i.test(r.name));
    if (!role) {
      if (active) problems.push('No "Suspended" role found in the server, so no role was given.');
      return;
    }
    if (active && !member.roles.includes(role.id)) await addMemberRole(userId, role.id).catch((e) => problems.push(`Couldn't give <@&${role.id}>: ${explain(e)}`));
    if (!active && member.roles.includes(role.id)) await removeMemberRole(userId, role.id).catch((e) => problems.push(`Couldn't remove <@&${role.id}>: ${explain(e)}`));
    return;
  }

  // Every "Strike N" style role, by number
  const numbered = roles
    .filter((r) => !r.managed && pattern!.test(r.name))
    .map((r) => ({ id: r.id, n: roleNumber(r.name) }))
    .filter((r): r is { id: string; n: number } => r.n !== null && r.n > 0);
  if (!numbered.length) {
    if (active) problems.push(`No "${INFRACTION_TYPES[kind]} 1" style roles found in the server, so no role was given.`);
    return;
  }
  const top = Math.max(...numbered.map((r) => r.n));
  const want = active ? numbered.find((r) => r.n === Math.min(active, top)) : undefined;
  if (active > top) problems.push(`They now have ${active} active ${INFRACTION_TYPES[kind].toLowerCase()}s, but the highest role is ${INFRACTION_TYPES[kind]} ${top}.`);
  for (const r of numbered) {
    if (r.id !== want?.id && member.roles.includes(r.id)) {
      await removeMemberRole(userId, r.id).catch((e) => problems.push(`Couldn't remove <@&${r.id}>: ${explain(e)}`));
    }
  }
  if (want && !member.roles.includes(want.id)) {
    await addMemberRole(userId, want.id).catch((e) => problems.push(`Couldn't give <@&${want.id}>: ${explain(e)}`));
  }
}

export function suspensionModal(userId: string, kind: InfractionKind, reason: string, policy: string | null) {
  return {
    type: 9,
    data: {
      custom_id: `${SUSPENSION_MODAL_PREFIX}${userId}:${kind}`,
      title: "Suspension details",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "duration",
              label: "Suspension duration",
              style: 1,
              required: true,
              max_length: 60,
              placeholder: "e.g. 3 days, 1 week, until further notice",
            },
          ],
        },
        {
          type: 1,
          components: [
            { type: 4, custom_id: "reason", label: "Reason", style: 2, required: true, max_length: 1000, value: reason.slice(0, 1000) },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "policy",
              label: "Policy broken (optional)",
              style: 1,
              required: false,
              max_length: 100,
              ...(policy ? { value: policy.slice(0, 100) } : {}),
            },
          ],
        },
      ],
    },
  };
}

export async function runInfraction(opts: {
  token: string;
  commandChannelId: string;
  issuer: Member;
  userId: string;
  userName: string;
  kind: InfractionKind;
  reason: string;
  policy: string | null;
  duration: string | null;
}) {
  const { token, issuer, userId, kind, reason, duration } = opts;
  const policy = opts.policy?.trim() || null;
  const problems: string[] = [];
  try {
    let userName = opts.userName;
    if (!userName) userName = await fetchGuildMember(userId).then((m) => m.user.username).catch(() => userId);
    const row = await queryOne<Infraction>(
      `INSERT INTO infractions (user_id, user_name, kind, reason, policy, duration, issuer_id, issuer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [userId, userName, kind, reason, policy, duration, issuer.user.id, displayName(issuer)],
    );
    const inf = row!;

    // Post the notice and open the evidence thread
    const channelId = (await disciplineConfig()).infractionsChannelId || opts.commandChannelId;
    const msg = await postChannelMessage(channelId, {
      components: infractionMessage(inf),
      allowed_mentions: { parse: [], users: [userId] },
    });
    let threadId: string | null = null;
    try {
      const thread = await startThreadFromMessage(msg.channel_id, msg.id, `${caseRef(inf.id)} — Evidence`);
      threadId = thread.id;
      await postChannelMessage(thread.id, {
        components: [
          container(
            [text(`<@${issuer.user.id}> please put **all evidence** for **${caseRef(inf.id)}** in this thread — screenshots, clips and any relevant links.`)],
            false,
          ),
        ],
        allowed_mentions: { parse: [], users: [issuer.user.id] },
      });
    } catch (e) {
      problems.push(`Couldn't open the evidence thread: ${explain(e)}`);
    }
    await query(`UPDATE infractions SET channel_id=$1, message_id=$2, thread_id=$3 WHERE id=$4`, [
      msg.channel_id,
      msg.id,
      threadId,
      inf.id,
    ]);

    // Termination: strip roles (keep Community Member) and free the callsign
    // Blacklist: strip everything but Civilian, then give the State Blacklist role
    if (kind === "termination" || kind === "blacklist") {
      const removed = await stripRoles(userId, problems, kind).catch((e) => {
        problems.push(`Couldn't strip roles: ${explain(e)}`);
        return [] as string[];
      });
      await query(`UPDATE infractions SET removed_roles=$1 WHERE id=$2`, [JSON.stringify(removed), inf.id]);
      if (kind === "blacklist") {
        const role = await blacklistRoleId();
        if (!role) problems.push("No State Blacklist role is set — pick one on Portal → Discord Setup.");
        else await addMemberRole(userId, role).catch((e) => problems.push(`Couldn't give the State Blacklist role: ${explain(e)}`));
      }
      invalidateRosterCache();
    }

    // Matching role: Strike 1 / Strike 2…, Warning 1…, Suspended
    await syncInfractionRoles(userId, kind, problems).catch((e) => problems.push(`Couldn't update infraction roles: ${explain(e)}`));

    const dm = await sendDirectMessageV2(userId, infractionDM(inf));
    if (!dm) problems.push("Couldn't DM the member (their DMs may be closed).");

    await editInteractionResponse(token, {
      content:
        `**${caseRef(inf.id)}** issued to <@${userId}> (${INFRACTION_TYPES[kind]}). Posted in <#${msg.channel_id}>` +
        (threadId ? `, evidence thread: <#${threadId}>.` : ".") +
        (problems.length ? `\n${problems.join("\n")}` : ""),
    });
  } catch (e) {
    console.error("[infraction] failed", e);
    await editInteractionResponse(token, { content: `Infraction failed: ${explain(e)}` }).catch(() => {});
  }
}

export async function runVoid(opts: { token: string; issuer: Member; caseId: number; reason: string | null }) {
  const { token, issuer, caseId } = opts;
  const problems: string[] = [];
  try {
    const existing = await queryOne<Infraction>(`SELECT * FROM infractions WHERE id=$1`, [caseId]);
    if (!existing) {
      await editInteractionResponse(token, { content: `${caseRef(caseId)} doesn't exist.` });
      return;
    }
    if (existing.status === "voided") {
      await editInteractionResponse(token, { content: `${caseRef(caseId)} is already voided.` });
      return;
    }
    const inf = (await queryOne<Infraction>(
      `UPDATE infractions SET status='voided', voided_by_id=$1, voided_by_name=$2, void_reason=$3, voided_at=now()
       WHERE id=$4 RETURNING *`,
      [issuer.user.id, displayName(issuer), opts.reason, caseId],
    ))!;

    // Update the original notice
    if (inf.channel_id && inf.message_id) {
      await editChannelMessage(inf.channel_id, inf.message_id, { components: infractionMessage(inf) }).catch((e) =>
        problems.push(`Couldn't update the original notice: ${explain(e)}`),
      );
    }
    if (inf.thread_id) {
      await postChannelMessage(inf.thread_id, {
        components: [container([text(`**${caseRef(inf.id)}** was voided by <@${issuer.user.id}>.`)], false)],
      }).catch(() => {});
    }

    // Step the infraction role back (Strike 2 → Strike 1, or none)
    await syncInfractionRoles(inf.user_id, inf.kind, problems).catch((e) => problems.push(`Couldn't update infraction roles: ${explain(e)}`));

    // Undo a blacklist: take the State Blacklist role off
    if (inf.kind === "blacklist") {
      const role = await blacklistRoleId();
      if (role) await removeMemberRole(inf.user_id, role).catch((e) => problems.push(`Couldn't remove the State Blacklist role: ${explain(e)}`));
    }
    // Undo a termination or blacklist: give the roles back
    if ((inf.kind === "termination" || inf.kind === "blacklist") && inf.removed_roles) {
      const roles: string[] = typeof inf.removed_roles === "string" ? JSON.parse(inf.removed_roles) : inf.removed_roles;
      for (const r of roles) await addMemberRole(inf.user_id, r).catch((e) => problems.push(`Couldn't restore <@&${r}>: ${explain(e)}`));
      if (roles.length) {
        await assignCallsignForMember(inf.user_id).catch(() => {});
        invalidateRosterCache();
      }
    }

    await sendDirectMessageV2(inf.user_id, [
      container([
        text(`> Your **${INFRACTION_TYPES[inf.kind]}** (ID: ${inf.id}) has been **voided** and removed from your record.`),
        ...(opts.reason ? [text(`**Reason:** ${clean(opts.reason, 400)}`)] : []),
        text(`-# Florida Highway Patrol — ${clean(site.community, 60)}`),
        divider(),
      ]),
    ]);

    await editInteractionResponse(token, {
      content:
        `${caseRef(inf.id)} voided.` +
        (inf.kind === "termination" || inf.kind === "blacklist" ? " Their roles have been restored." : "") +
        (problems.length ? `\n${problems.join("\n")}` : ""),
    });
  } catch (e) {
    console.error("[void] failed", e);
    await editInteractionResponse(token, { content: `Couldn't void the case: ${explain(e)}` }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Slash command definitions                                           */
/* ------------------------------------------------------------------ */

export const DISCIPLINE_COMMANDS = [
  {
    name: "promote",
    description: "Promote a member (Command, High Command and Office of the Colonel only)",
    type: 1,
    contexts: [0],
    options: [
      { type: 6, name: "user", description: "Who is being promoted", required: true },
      { type: 3, name: "reason", description: "Why they are being promoted", required: true, max_length: 800 },
      { type: 8, name: "new_rank", description: "Their new rank role", required: true },
      { type: 8, name: "old_rank", description: "Their current rank role (will be removed)", required: true },
    ],
  },
  {
    name: "infraction",
    description: "Issue or void infractions (Human Resources and Office of the Colonel only)",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 1,
        name: "issue",
        description: "Issue an infraction",
        options: [
          { type: 6, name: "user", description: "Who is receiving the infraction", required: true },
          { type: 3, name: "reason", description: "Why the infraction is being issued", required: true, max_length: 1000 },
          {
            type: 3,
            name: "type",
            description: "Infraction type (suspension will ask for a duration)",
            required: true,
            choices: (Object.keys(INFRACTION_TYPES) as InfractionKind[]).map((k) => ({ name: INFRACTION_TYPES[k], value: k })),
          },
          { type: 3, name: "policy", description: "Policy broken, e.g. Shift Grinding (optional)", required: false, max_length: 100 },
        ],
      },
      {
        type: 1,
        name: "void",
        description: "Void an infraction",
        options: [
          { type: 4, name: "case_id", description: "The case number to void", required: true, min_value: 1 },
          { type: 3, name: "reason", description: "Why it is being voided", required: false, max_length: 400 },
        ],
      },
    ],
  },
];

/** Blacklisted members can't apply: they hold the State Blacklist role or have an active Blacklist infraction. */
export async function isBlacklisted(userId: string, roles: string[]) {
  const role = await blacklistRoleId();
  if (role && roles.includes(role)) return true;
  const row = await queryOne(`SELECT id FROM infractions WHERE user_id=$1 AND kind='blacklist' AND status <> 'voided' LIMIT 1`, [userId]).catch(
    () => null,
  );
  return Boolean(row);
}
