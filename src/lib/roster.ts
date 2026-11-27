import { fmtCallsign, fmtCallsignV2, parseCallsign } from "./callsign";
import "server-only";
import { env } from "./env";
import { query, queryOne } from "./db";
import { getConfig, rolesFor } from "./config";
import { container, divider, text } from "./components";
import {
  DiscordError,
  fetchGuildMember,
  fetchGuildMembers,
  fetchGuildRoles,
  sendDirectMessageV2,
  setNickname,
  type GuildMember,
  type GuildRole,
} from "./discord-bot";

/* ------------------------------------------------------------------ */
/* Ranks & callsign blocks                                             */
/* ------------------------------------------------------------------ */

export const TIERS = [
  { key: "ootc", label: "Office of the Colonel", showVacancies: true },
  { key: "command", label: "Command", showVacancies: true },
  { key: "supervisors", label: "Supervisors", showVacancies: true },
  { key: "patrol", label: "Patrol", showVacancies: true },
] as const;
export type TierKey = (typeof TIERS)[number]["key"];

type Rank = {
  key: string;
  label: string;
  tier: TierKey;
  block: readonly [number, number];
  name: string;
  /** false = don't list empty numbers as Vacant (for big blocks) */
  vacancies?: boolean;
};

/**
 * Ranks top to bottom. ONLY roles named "𝐆𝐒𝐏 | <rank>" count (medals, keys, division ranks like "𝐍𝐇 | Corporal",
 * "Active Trooper" etc. are ignored). Each rank owns a block of callsigns; for the Office of the Colonel and
 * Command, empty numbers show on the roster as Vacant.
 */
export const RANKS = [
  { key: "colonel", label: "Colonel", tier: "ootc", block: [1, 1], name: "colonel" },
  { key: "ltcol", label: "Lieutenant Colonel", tier: "ootc", block: [2, 3], name: "lieutenant colonel" },
  // Matches the FHP Main Database roster
  { key: "major", label: "Major", tier: "command", block: [4, 5], name: "major" },
  { key: "captain", label: "Captain", tier: "command", block: [6, 8], name: "captain" },
  { key: "lieutenant", label: "Lieutenant", tier: "command", block: [10, 13], name: "lieutenant" },
  { key: "sgt", label: "Sergeant", tier: "supervisors", block: [14, 17], name: "sergeant" },
  { key: "cpl", label: "Corporal", tier: "supervisors", block: [18, 20], name: "corporal" },
  { key: "tpr", label: "Trooper", tier: "patrol", block: [24, 30], name: "trooper" },
  { key: "prob", label: "Probationary Trooper", tier: "patrol", block: [310, 400], name: "probationary trooper", vacancies: false },
] as const satisfies readonly Rank[];
export type RankKey = (typeof RANKS)[number]["key"];

const RANK_ORDER = RANKS.map((r) => r.key) as RankKey[];
const rankIndex = (k: RankKey | null) => (k ? RANK_ORDER.indexOf(k) : RANK_ORDER.length);
export const rankInfo = (k: RankKey): Rank => RANKS.find((r) => r.key === k)!;

/** Rank roles look like "FHP | Colonel" (fancy letters like "𝐅𝐇𝐏" become plain "FHP" after NFKC normalisation). */
const RANK_ROLE_PREFIX = /^\s*(?:FHP|GSP)\s*[|│¦:\-–—]\s*/i;

/** Department roles (Portal → Discord Setup): anyone holding one is on the roster even without a rank (e.g. cadets). */
async function departmentRoleIds() {
  return rolesFor(await getConfig(), "ootc", "highCommand", "command", "supervisor", "patrol", "personnel");
}

/**
 * Which rank a Discord role represents, by its name. The whole name must be the rank — "Captain" or "FHP | Captain" —
 * so roles like "Office of the Colonel", "CIU | Commander" or "Wanting CIU" never count as ranks.
 */
export function rankForRoleName(name: string): RankKey | null {
  const n = name.normalize("NFKC");
  const prefix = RANK_ROLE_PREFIX.exec(n);
  const rest = (prefix ? n.slice(prefix[0].length) : n)
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return RANKS.find((r) => r.name === rest)?.key ?? null;
}

/* ------------------------------------------------------------------ */
/* Reports stored in the meta table                                    */
/* ------------------------------------------------------------------ */

async function getMeta<T>(key: string): Promise<T | null> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM meta WHERE key=$1`, [key]);
  return row ? (JSON.parse(row.value) as T) : null;
}
async function setMeta(key: string, value: unknown) {
  await query(`INSERT INTO meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [
    key,
    JSON.stringify(value),
  ]);
}

/**
 * Assignments shown on the roster. They belong to the POSITION, not the person:
 *  - slots: per callsign (Office of the Colonel + Command), e.g. 610 → "Overseer of NH, HR"
 *  - ranks: per rank (Supervisors + Patrol), e.g. Corporal → "Field Training Officer"
 * Edited in the portal (Roster & Callsigns).
 */
export type Assignments = { slots: Record<string, string>; ranks: Partial<Record<RankKey, string>> };
const DEFAULT_ASSIGNMENTS: Assignments = {
  slots: {
    "1": "Commanding Officer",
    "2": "Deputy Commander",
    "3": "Deputy Commander",
    "6": "Patrol Command",
    "7": "Patrol Command",
    "8": "Patrol Command",
    "11": "Division Commander",
    "12": "Division Commander",
    "13": "Division Commander",
  },
  ranks: {},
};

/** Old 3-digit command callsigns (600–635) → their C-## position, so saved assignments follow the seat. */
const OLD_SLOT: Record<string, number> = { "600": 1, "601": 2, "602": 3, "610": 4, "611": 5, "612": 6 };
for (let i = 0; i < 6; i++) {
  OLD_SLOT[String(620 + i)] = 7 + i;
  OLD_SLOT[String(630 + i)] = 13 + i;
}

export async function getAssignments(): Promise<Assignments> {
  const a = await getMeta<Partial<Assignments>>("roster_assignments");
  if (!a) return DEFAULT_ASSIGNMENTS;
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.slots ?? {})) {
    const n = Number(k) >= 100 ? OLD_SLOT[k] : Number(k);
    if (n) slots[String(n)] = v;
  }
  return { slots, ranks: a.ranks ?? {} };
}
export async function saveAssignmentsData(a: Assignments) {
  await setMeta("roster_assignments", a);
}
export function assignmentFor(a: Assignments, rank: RankKey | null, callsign: number | null) {
  return (callsign !== null ? a.slots[String(callsign)] : undefined) ?? (rank ? a.ranks[rank] : undefined);
}
/** Ranks whose assignments are set per callsign slot. */
export const SLOT_RANKS = RANKS.filter(
  (r) => TIERS.find((t) => t.key === r.tier)!.showVacancies && (r as Rank).vacancies !== false,
);

export type SyncReport = {
  at: string;
  reissued: boolean;
  members: number;
  newCallsigns: number;
  nicknamesUpdated: number;
  failures: { name: string; reason: string }[];
  /** e.g. "Major (all 3 spots taken): Sam Price" */
  noSpot: string[];
};
/** The last sync report. Older reports (saved before rank-based callsigns) are filled in so pages don't break. */
export async function getLastSync(): Promise<SyncReport | null> {
  const r = await getMeta<Partial<SyncReport>>("roster_last_sync");
  if (!r || !r.at) return null;
  return {
    at: r.at,
    reissued: !!r.reissued,
    members: r.members ?? 0,
    newCallsigns: r.newCallsigns ?? 0,
    nicknamesUpdated: r.nicknamesUpdated ?? 0,
    failures: Array.isArray(r.failures) ? r.failures : [],
    noSpot: Array.isArray(r.noSpot) ? r.noSpot : [],
  };
}

/* ------------------------------------------------------------------ */
/* Building the roster                                                 */
/* ------------------------------------------------------------------ */

export type RosterEntry = {
  userId: string;
  name: string; // name without the callsign prefix
  username: string;
  avatar: string | null;
  nick: string | null;
  rank: RankKey | null;
  callsign: number | null;
  /** The number currently at the front of their nickname, used to keep seniority when renumbering. */
  nickCallsign: number | null;
};

/** A callsign at the front of a nickname: "2011 | Name", "C-07 | Name", "602 | Name", "602 I Name", "602 - Name", "602/Name"… */
const CALLSIGN_PREFIX = /^\s*(?:C\s*-\s*\d{1,3}|\d{2,4})\s*(?:[|│¦\-–—:/\\]|\s[Il](?=\s))\s*/i;

/** Set to false to pause automatic callsigns and nickname changes (the roster still lists everyone by rank). */
export const CALLSIGNS_READY = true;

/** "602 | Ryan Callahan" → "Ryan Callahan" */
export function baseName(m: GuildMember) {
  const raw = (m.nick || m.user.global_name || m.user.username).trim();
  let name = raw;
  // Strip every leading callsign ("901 | 839 I M. Hardy" → "M. Hardy")
  for (let i = 0; i < 5 && CALLSIGN_PREFIX.test(name); i++) name = name.replace(CALLSIGN_PREFIX, "");
  return name.trim() || m.user.username;
}

export const nicknameFor = (callsign: number | null, name: string) =>
  (callsign === null ? name : `${fmtCallsign(callsign)} | ${name}`).slice(0, 32);

let cache: { at: number; members: GuildMember[]; roles: GuildRole[] } | null = null;

async function loadDiscord(fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache;
  const [members, roles] = await Promise.all([fetchGuildMembers(), fetchGuildRoles()]);
  cache = { at: Date.now(), members, roles };
  return cache;
}

export function invalidateRosterCache() {
  cache = null;
}

function rankRoleMap(roles: GuildRole[]) {
  const map = new Map<string, RankKey>();
  for (const r of roles) {
    // A role can be both a department role and a rank (e.g. "Major" chosen as High Command), so don't skip those
    if (r.name === "@everyone") continue;
    const k = rankForRoleName(r.name);
    if (k) map.set(r.id, k);
  }
  return map;
}

function memberRank(roleIds: string[], rankByRole: Map<string, RankKey>): RankKey | null {
  const ranks = roleIds.map((id) => rankByRole.get(id)).filter((r): r is RankKey => !!r);
  return ranks.length ? ranks.sort((a, b) => rankIndex(a) - rankIndex(b))[0] : null;
}

let rolesCache: { at: number; roles: GuildRole[] } | null = null;

/** A member's FHP rank from their role IDs (guild roles cached for 5 minutes). Null if none / lookup fails. */
export async function rankForRoles(roleIds: string[]): Promise<RankKey | null> {
  try {
    if (!rolesCache || Date.now() - rolesCache.at > 300_000) rolesCache = { at: Date.now(), roles: await fetchGuildRoles() };
    return memberRank(roleIds, rankRoleMap(rolesCache.roles));
  } catch {
    return null;
  }
}

/** Everyone on the roster, sorted by rank, then callsign, then name. */
export async function buildRoster({ fresh = false } = {}) {
  const { members, roles } = await loadDiscord(fresh);
  const dept = await departmentRoleIds();
  const rankByRole = rankRoleMap(roles);
  const callsigns = new Map(
    (await query<{ user_id: string; callsign: number }>(`SELECT user_id, callsign FROM roster_callsigns`)).map((r) => [
      r.user_id,
      Number(r.callsign),
    ]),
  );

  const entries: RosterEntry[] = [];
  for (const m of members) {
    if (m.user.bot) continue;
    const rank = memberRank(m.roles, rankByRole);
    if (!rank && !m.roles.some((r) => dept.includes(r))) continue;
    entries.push({
      userId: m.user.id,
      name: baseName(m),
      username: m.user.username,
      avatar: m.user.avatar ?? null,
      nick: m.nick ?? null,
      rank,
      callsign: callsigns.get(m.user.id) ?? null,
      nickCallsign: CALLSIGN_PREFIX.test(m.nick ?? "") ? parseCallsign(CALLSIGN_PREFIX.exec(m.nick!)![0].replace(/[^\dC-]/gi, "")) : null,
    });
  }
  entries.sort(
    (a, b) =>
      rankIndex(a.rank) - rankIndex(b.rank) ||
      (a.callsign ?? 9999) - (b.callsign ?? 9999) ||
      (a.nickCallsign ?? 9999) - (b.nickCallsign ?? 9999) ||
      a.name.localeCompare(b.name),
  );

  // Which Discord role(s) were matched to each rank (shown in the portal)
  const detected = new Map<RankKey, string[]>();
  for (const r of roles) {
    const k = rankByRole.get(r.id);
    if (k) detected.set(k, [...(detected.get(k) ?? []), r.name]);
  }
  return { entries, detected };
}

/* ------------------------------------------------------------------ */
/* Assigning callsigns                                                 */
/* ------------------------------------------------------------------ */

const inBlock = (n: number | null, rank: RankKey | null) => {
  if (n === null || !rank) return false;
  const [lo, hi] = rankInfo(rank).block;
  return n >= lo && n <= hi;
};

function lowestFree(rank: RankKey, taken: Set<number>) {
  const [lo, hi] = rankInfo(rank).block;
  for (let n = lo; n <= hi; n++) if (!taken.has(n)) return n;
  return null;
}

async function saveCallsign(userId: string, callsign: number | null) {
  if (callsign === null) await query(`DELETE FROM roster_callsigns WHERE user_id=$1`, [userId]);
  else
    await query(
      `INSERT INTO roster_callsigns (user_id, callsign) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET callsign=EXCLUDED.callsign, assigned_at=now()`,
      [userId, callsign],
    );
}

function explain(err: unknown) {
  return err instanceof DiscordError && err.status === 403
    ? "The bot can't rename this member (server owner, or their role is above the bot's)."
    : (err as Error).message.slice(0, 160);
}

/**
 * Makes everyone's callsign match their rank's block and sets nicknames to "311 | Name".
 * reissue = true clears all callsigns first, so everyone is numbered fresh within their block.
 */
/** Callsigns and appointments from the FHP Main Database spreadsheet (applied once, then managed on the site). */
const SHEET_CALLSIGNS: Record<string, number> = {
  "363743801027592202": 1, // Colonel — Jeremy_C67
  "1328906299697528832": 2, // Lt. Colonel — Donnie Vance
  "305756136882307072": 3, // Lt. Colonel — Bo-Greet
  "1400588799200727242": 5, // Major — Kyle Johnson
  "761534295596204056": 6, // Captain — Patrick Callahan
  "931956257236062228": 8, // Captain — Rachel Thomas
  "1278512421958582415": 10, // Lieutenant — Wyatt Brooks
  "903387599035588629": 11, // Lieutenant — Martin James
  "787822949658132502": 12, // Lieutenant — John Sheinbeck (K-01)
  "1240982789814358027": 14, // Sergeant — Jackson S Caine
  "1152730210907725834": 15, // Sergeant — Landon Simmons
  "1487207317958037554": 19, // Corporal — Jackson Basit
  "1393281707398004868": 24, // Trooper — James Sanders
  "1088464322977599498": 25, // Trooper — Leilani DeJesus
  "417172974895104000": 29, // Trooper — Karen Killmore
};
const SHEET_APPOINTMENTS: Record<string, string> = {
  "1": "Overall Department Operations",
  "2": "Administrative & Personnel Operations",
  "3": "Special & Patrol Operations",
  "4": "Patrol Coordinator",
  "5": "Administrative Coordinator / Special Operations Coordinator",
  "6": "Patrol Operations Captain",
  "7": "Administrative Operations Assistant",
  "8": "Special Operations",
  "10": "Patrol Lieutenant",
  "11": "Criminal Interdiction Lieutenant",
  "12": "Canine Unit Lieutenant",
  "13": "Aggressive Driving Unit Lieutenant",
  "14": "Field Supervisory Staff",
  "15": "Criminal Interdiction Unit Sergeant",
  "16": "Canine Unit Sergeant",
  "17": "Aggressive Driving Unit Sergeant",
  "18": "Field Training Staff",
  "19": "Field Training Staff",
  "20": "Field Training Staff",
  "24": "Patrol Staff",
  "25": "Patrol Staff",
  "26": "Patrol Staff",
  "27": "Patrol Staff",
  "28": "Patrol Staff",
  "29": "Patrol Staff",
  "30": "Patrol Staff",
};

async function applySheetOnce() {
  const done = await queryOne(`INSERT INTO meta (key, value) VALUES ('callsigns_sheet_v1', 'true') ON CONFLICT (key) DO NOTHING RETURNING key`);
  if (!done) return;
  await query(`DELETE FROM roster_callsigns`);
  for (const [userId, n] of Object.entries(SHEET_CALLSIGNS)) await saveCallsign(userId, n);
  await setMeta("roster_assignments", { slots: SHEET_APPOINTMENTS, ranks: { prob: "Patrol Staff" } });
}

export async function syncRoster({ reissue = false } = {}): Promise<SyncReport> {
  if (!env.discord.botToken) throw new Error("DISCORD_BOT_TOKEN is not set.");
  await applySheetOnce();
  if (!CALLSIGNS_READY) throw new Error("Callsigns are paused until the FHP ranks and C-## numbers are set up.");
  await setMeta("roster_sync_running", Date.now());
  try {
    if (reissue) await query(`DELETE FROM roster_callsigns`);
    const { entries } = await buildRoster({ fresh: true });
    const before = new Map(entries.map((e) => [e.userId, e.callsign]));

    // People who left the roster lose their callsign
    const onRoster = entries.map((e) => e.userId);
    if (onRoster.length) await query(`DELETE FROM roster_callsigns WHERE NOT (user_id = ANY($1::text[]))`, [onRoster]);
    else await query(`DELETE FROM roster_callsigns`);

    // Keep callsigns that already fit the member's rank; everyone else gets the lowest free number in their block
    const taken = new Set<number>();
    const needs: RosterEntry[] = [];
    for (const e of entries) {
      if (e.rank && inBlock(e.callsign, e.rank) && !taken.has(e.callsign!)) {
        taken.add(e.callsign!);
      } else {
        e.callsign = null;
        if (e.rank) needs.push(e);
      }
    }
    let newCallsigns = 0;
    const noSpot: string[] = [];
    for (const e of needs) {
      const next = lowestFree(e.rank!, taken);
      if (next === null) {
        const r = rankInfo(e.rank!);
        noSpot.push(`${r.label} (all ${r.block[1] - r.block[0] + 1} spots taken): ${e.name}`);
        continue;
      }
      taken.add(next);
      e.callsign = next;
      newCallsigns++;
    }
    // Save only what changed (two passes so no unique-number clash mid-way)
    const changed = entries.filter((e) => before.get(e.userId) !== e.callsign);
    for (const e of changed) await saveCallsign(e.userId, null);
    for (const e of changed) if (e.callsign !== null) await saveCallsign(e.userId, e.callsign);

    // Nicknames
    let nicknamesUpdated = 0;
    const failures: SyncReport["failures"] = [];
    for (const e of entries) {
      const desired = nicknameFor(e.callsign, e.name);
      if ((e.nick ?? null) === desired || (!e.nick && e.callsign === null)) continue;
      try {
        await setNickname(e.userId, desired);
        nicknamesUpdated++;
      } catch (err) {
        failures.push({ name: desired, reason: explain(err) });
      }
    }

    cache = null;
    const report: SyncReport = {
      at: new Date().toISOString(),
      reissued: reissue,
      members: entries.length,
      newCallsigns,
      nicknamesUpdated,
      failures,
      noSpot,
    };
    await setMeta("roster_last_sync", report);
    return report;
  } finally {
    await query(`DELETE FROM meta WHERE key='roster_sync_running'`);
  }
}

/**
 * Gives ONE member the right callsign for their current rank (after a promotion or a restored termination):
 * keeps their number if it already fits, otherwise the lowest free number in their rank's block.
 */
export async function assignCallsignForMember(userId: string) {
  const [member, roles] = await Promise.all([fetchGuildMember(userId), fetchGuildRoles()]);
  const rank = memberRank(member.roles, rankRoleMap(roles));
  if (!CALLSIGNS_READY) {
    return { old: null, next: null, rank: rank ? rankInfo(rank).label : null, full: false, nickError: null, paused: true };
  }
  const mine = await queryOne<{ callsign: number }>(`SELECT callsign FROM roster_callsigns WHERE user_id=$1`, [userId]);
  const old = mine ? Number(mine.callsign) : null;

  let next: number | null = null;
  if (rank) {
    if (inBlock(old, rank)) next = old;
    else {
      const taken = new Set(
        (await query<{ callsign: number }>(`SELECT callsign FROM roster_callsigns WHERE user_id <> $1`, [userId])).map((r) =>
          Number(r.callsign),
        ),
      );
      next = lowestFree(rank, taken);
    }
  }
  await saveCallsign(userId, next);

  const desired = nicknameFor(next, baseName(member));
  let nickError: string | null = null;
  if ((member.nick ?? null) !== desired && !(member.nick === null && next === null)) {
    await setNickname(userId, desired).catch((e) => (nickError = explain(e)));
  }
  cache = null;
  return { old, next, rank: rank ? rankInfo(rank).label : null, full: !!rank && next === null, nickError, paused: false };
}

export async function releaseCallsign(userId: string) {
  await query(`DELETE FROM roster_callsigns WHERE user_id=$1`, [userId]);
  cache = null;
}

/** Runs a normal sync if the last one was more than 10 minutes ago (called when the roster is viewed). */
/**
 * One-time: the Updated Callsign Sheet (3##/4##/5##/6##). Renames everyone to the new format straight away,
 * then DMs each member their new callsign. Runs once, on the first roster visit after the change goes live.
 */
export async function announceCallsignFormatOnce() {
  if (!env.discord.botToken || !CALLSIGNS_READY) return;
  const claimed = await queryOne(
    `INSERT INTO meta (key, value) VALUES ('callsign_format_v3_announced', now()::text) ON CONFLICT (key) DO NOTHING RETURNING key`,
  );
  if (!claimed) return;
  try {
    await syncRoster();
  } catch (e) {
    console.error("[roster] callsign format change: sync failed", e);
    await query(`DELETE FROM meta WHERE key='callsign_format_v3_announced'`); // try again next visit
    return;
  }
  const { entries } = await buildRoster();
  let sent = 0;
  let failed = 0;
  for (const e of entries) {
    if (e.callsign === null) continue;
    const old = fmtCallsignV2(e.callsign);
    const ok = await sendDirectMessageV2(e.userId, [
      container([
        text(
          "## Callsign Update\n" +
            "> Another change has been made by the **Overseers** — Florida Highway Patrol callsigns have been updated again. **Effective immediately.**\n\n" +
            `Your callsign has been changed to **${fmtCallsign(e.callsign)}** (was ${old}), and your Discord nickname has been updated to match.`,
        ),
        divider(),
        text(
          "**FHP callsigns**\n" +
            "`3##` — High Command\n" +
            "`4##` — Supervisory Staff\n" +
            "`5##` — Patrol Troopers\n" +
            "`6##` — Probationary Troopers\n" +
            "`K-##` — K-9 units",
        ),
        text("-# Use your new callsign on the radio and in game from now on. Questions? Contact your supervisor."),
      ]),
    ]).catch(() => false);
    if (ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 400)); // stay under Discord's DM rate limits
  }
  await setMeta("callsign_format_v3_result", { sent, failed, at: new Date().toISOString() });
  console.log(`[roster] callsign format change: DMed ${sent}, couldn't DM ${failed}`);
}

export async function syncIfStale() {
  if (!env.discord.botToken || !CALLSIGNS_READY) return;
  const running = await getMeta<number>("roster_sync_running");
  if (running && Date.now() - running < 5 * 60_000) return;
  const last = await getLastSync();
  if (last && Date.now() - new Date(last.at).getTime() < 10 * 60_000) return;
  await syncRoster().catch((e) => console.error("[roster] auto-sync failed", e));
}

/**
 * Gives a member a specific callsign by hand (Portal → Roster & Callsigns). The number must be in their rank's
 * block; if someone else holds it, the two swap. Both nicknames are updated.
 */
export async function setCallsignManually(userId: string, callsign: number) {
  const { entries } = await buildRoster({ fresh: true });
  const me = entries.find((e) => e.userId === userId);
  if (!me) throw new Error("That member isn't on the roster.");
  if (!me.rank) throw new Error(`${me.name} has no rank role, so they can't have a callsign.`);
  if (!inBlock(callsign, me.rank)) {
    const r = rankInfo(me.rank);
    throw new Error(`${fmtCallsign(callsign)} isn't a ${r.label} callsign (${fmtCallsign(r.block[0])}–${fmtCallsign(r.block[1])}).`);
  }
  const other = entries.find((e) => e.callsign === callsign && e.userId !== userId) ?? null;
  if (other && !inBlock(me.callsign, other.rank)) {
    throw new Error(`${fmtCallsign(callsign)} belongs to ${other.name}, who can't take ${me.callsign !== null ? fmtCallsign(me.callsign) : "no callsign"} in return.`);
  }
  // Free both numbers first so the unique constraint never clashes, then assign
  await saveCallsign(userId, null);
  if (other) await saveCallsign(other.userId, null);
  await saveCallsign(userId, callsign);
  if (other && me.callsign !== null) await saveCallsign(other.userId, me.callsign);

  const problems: string[] = [];
  for (const [e, n] of [[me, callsign], ...(other ? [[other, me.callsign] as const] : [])] as const) {
    const desired = nicknameFor(n, e.name);
    if ((e.nick ?? null) !== desired) await setNickname(e.userId, desired).catch((err) => problems.push(`${desired}: ${explain(err)}`));
  }
  cache = null;
  return { me: me.name, other: other?.name ?? null, oldCallsign: me.callsign, problems };
}
