import "server-only";
import { env } from "./env";
import { query, queryOne } from "./db";
import {
  DiscordError,
  fetchGuildMember,
  fetchGuildMembers,
  fetchGuildRoles,
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
  { key: "supervisors", label: "Supervisors", showVacancies: false },
  { key: "patrol", label: "Patrol", showVacancies: false },
] as const;
export type TierKey = (typeof TIERS)[number]["key"];

type Rank = { key: string; label: string; tier: TierKey; block: readonly [number, number]; match: RegExp };

/**
 * Ranks top to bottom. A member's rank comes from their Discord role NAME. Each rank owns a block of
 * callsigns; for the Office of the Colonel and Command, empty numbers show on the roster as Vacant.
 */
export const RANKS = [
  { key: "colonel", label: "Colonel", tier: "ootc", block: [600, 600], match: /\bcolonel\b/i },
  { key: "ltcol", label: "Lieutenant Colonel", tier: "ootc", block: [601, 602], match: /\b(lieutenant|lt)\.?\s*col(onel)?\b/i },
  { key: "major", label: "Major", tier: "command", block: [610, 612], match: /\b(major|maj)\b/i },
  { key: "captain", label: "Captain", tier: "command", block: [620, 623], match: /\b(captain|capt|cpt)\b/i },
  { key: "lieutenant", label: "Lieutenant", tier: "command", block: [630, 632], match: /\b(lieutenant|lt)\b/i },
  { key: "ssgt", label: "Staff Sergeant", tier: "supervisors", block: [700, 719], match: /\b(staff\s*(sergeant|sgt)|ssgt)\b/i },
  { key: "sgt", label: "Sergeant", tier: "supervisors", block: [720, 749], match: /\b(sergeant|sgt)\b/i },
  { key: "cpl", label: "Corporal", tier: "supervisors", block: [750, 799], match: /\b(corporal|cpl)\b/i },
  { key: "srtpr", label: "Senior Trooper", tier: "patrol", block: [800, 849], match: /\b(senior|sr)\.?\s*(trooper|tpr)\b/i },
  { key: "tfc", label: "Trooper First Class", tier: "patrol", block: [850, 899], match: /\b(trooper\s*first\s*class|tfc)\b/i },
  { key: "tpr", label: "Trooper", tier: "patrol", block: [900, 959], match: /\b(trooper|tpr)\b/i },
  { key: "prob", label: "Probationary Trooper", tier: "patrol", block: [960, 999], match: /\b(probationary|probie)\b/i },
] as const satisfies readonly Rank[];
export type RankKey = (typeof RANKS)[number]["key"];

const RANK_ORDER = RANKS.map((r) => r.key) as RankKey[];
const rankIndex = (k: RankKey | null) => (k ? RANK_ORDER.indexOf(k) : RANK_ORDER.length);
export const rankInfo = (k: RankKey): Rank => RANKS.find((r) => r.key === k)!;

/** Most specific names are checked first ("Lieutenant Colonel" before "Lieutenant", "Staff Sergeant" before "Sergeant"…). */
const MATCH_ORDER: RankKey[] = ["ltcol", "colonel", "major", "captain", "lieutenant", "ssgt", "sgt", "cpl", "srtpr", "tfc", "prob", "tpr"];

/** Department roles: anyone holding one of these is on the roster even without a rank (e.g. cadets). */
export const DEPARTMENT_ROLE_IDS = [
  "1558194099327074422", // Office of the Colonel
  "1558194099327074418", // High Command
  "1558194099297853566", // Command
  "1558194099268358282", // Supervisor
  "1558194099268358274", // Patrol
  "1558194099197059241", // Department Personnel
];

/** Which rank a Discord role represents, by its name. */
export function rankForRoleName(name: string): RankKey | null {
  if (/office of the colonel/i.test(name)) return null;
  for (const k of MATCH_ORDER) if (rankInfo(k).match.test(name)) return k;
  return null;
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
export const getLastSync = () => getMeta<SyncReport>("roster_last_sync");

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

/** "602 | Ryan Callahan" → "Ryan Callahan" */
export function baseName(m: GuildMember) {
  const raw = (m.nick || m.user.global_name || m.user.username).trim();
  return raw.replace(/^\s*\d{2,4}\s*[|│\-–—:]\s*/, "").trim() || m.user.username;
}

export const nicknameFor = (callsign: number | null, name: string) =>
  (callsign === null ? name : `${callsign} | ${name}`).slice(0, 32);

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
    if (DEPARTMENT_ROLE_IDS.includes(r.id) || r.name === "@everyone") continue;
    const k = rankForRoleName(r.name);
    if (k) map.set(r.id, k);
  }
  return map;
}

function memberRank(roleIds: string[], rankByRole: Map<string, RankKey>): RankKey | null {
  const ranks = roleIds.map((id) => rankByRole.get(id)).filter((r): r is RankKey => !!r);
  return ranks.length ? ranks.sort((a, b) => rankIndex(a) - rankIndex(b))[0] : null;
}

/** Everyone on the roster, sorted by rank, then callsign, then name. */
export async function buildRoster({ fresh = false } = {}) {
  const { members, roles } = await loadDiscord(fresh);
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
    if (!rank && !m.roles.some((r) => DEPARTMENT_ROLE_IDS.includes(r))) continue;
    entries.push({
      userId: m.user.id,
      name: baseName(m),
      username: m.user.username,
      avatar: m.user.avatar ?? null,
      nick: m.nick ?? null,
      rank,
      callsign: callsigns.get(m.user.id) ?? null,
      nickCallsign: Number(/^\s*(\d{2,4})\s*[|│\-–—:]/.exec(m.nick ?? "")?.[1] ?? NaN) || null,
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
 * Makes everyone's callsign match their rank's block and sets nicknames to "630 | Name".
 * reissue = true clears all callsigns first, so everyone is numbered fresh within their block.
 */
export async function syncRoster({ reissue = false } = {}): Promise<SyncReport> {
  if (!env.discord.botToken) throw new Error("DISCORD_BOT_TOKEN is not set.");
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
  return { old, next, rank: rank ? rankInfo(rank).label : null, full: !!rank && next === null, nickError };
}

export async function releaseCallsign(userId: string) {
  await query(`DELETE FROM roster_callsigns WHERE user_id=$1`, [userId]);
  cache = null;
}

/** Runs a normal sync if the last one was more than 10 minutes ago (called when the roster is viewed). */
export async function syncIfStale() {
  if (!env.discord.botToken) return;
  const running = await getMeta<number>("roster_sync_running");
  if (running && Date.now() - running < 5 * 60_000) return;
  const last = await getLastSync();
  if (last && Date.now() - new Date(last.at).getTime() < 10 * 60_000) return;
  await syncRoster().catch((e) => console.error("[roster] auto-sync failed", e));
}
