import "server-only";
import { env } from "./env";
import { query, queryOne } from "./db";
import {
  DiscordError,
  fetchGuildMembers,
  fetchGuildRoles,
  setNickname,
  type GuildMember,
  type GuildRole,
} from "./discord-bot";

/* ------------------------------------------------------------------ */
/* Chain of command                                                    */
/* ------------------------------------------------------------------ */

/** Roster sections, top to bottom. A member appears in the first section whose role they hold. */
export const SECTIONS = [
  { key: "ootc", label: "Office of the Colonel", roleId: "1558194099327074422" },
  { key: "high-command", label: "High Command", roleId: "1558194099327074418" },
  { key: "command", label: "Command", roleId: "1558194099297853566" },
  { key: "supervisors", label: "Supervisors", roleId: "1558194099268358282" },
  { key: "patrol", label: "Patrol", roleId: "1558194099268358274" },
  { key: "personnel", label: "Department Personnel", roleId: "1558194099197059241" },
] as const;

/** Callsign blocks, in order. When the 600s are full, the 700s are used. */
export const CALLSIGN_RANGES: [number, number][] = [
  [600, 699],
  [700, 799],
];

/** Role names that count as a rank when no ranks have been picked in the portal. */
const RANK_WORDS =
  /\b(colonel|lieutenant colonel|lt\.? ?col|major|captain|capt|lieutenant|lt|sergeant|sgt|master sergeant|staff sergeant|corporal|cpl|trooper|tfc|cadet|probationary|recruit)\b/i;

const SECTION_ROLE_IDS: string[] = SECTIONS.map((s) => s.roleId);

/* ------------------------------------------------------------------ */
/* Settings stored in the database (meta table)                        */
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

/** Role IDs picked as ranks in the portal, or null to detect ranks from role names. */
export const getRankRoleSetting = () => getMeta<string[]>("roster_rank_roles");
export const setRankRoleSetting = (ids: string[] | null) =>
  ids ? setMeta("roster_rank_roles", ids) : query(`DELETE FROM meta WHERE key='roster_rank_roles'`);

export type SyncReport = {
  at: string;
  reissued: boolean;
  members: number;
  newCallsigns: number;
  nicknamesUpdated: number;
  failures: { name: string; reason: string }[];
  outOfCallsigns: number;
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
  rank: string | null;
  rankPosition: number;
  section: (typeof SECTIONS)[number]["key"];
  callsign: number | null;
};

export function isRankRole(r: GuildRole, picked: string[] | null) {
  if (SECTION_ROLE_IDS.includes(r.id) || r.name === "@everyone") return false;
  return picked ? picked.includes(r.id) : RANK_WORDS.test(r.name);
}

/** "602 | Ryan Callahan" → "Ryan Callahan" */
export function baseName(m: GuildMember) {
  const raw = (m.nick || m.user.global_name || m.user.username).trim();
  return raw.replace(/^\s*\d{2,4}\s*[|│\-–—:]\s*/, "").trim() || m.user.username;
}

export const nicknameFor = (callsign: number, name: string) => `${callsign} | ${name}`.slice(0, 32);

let cache: { at: number; members: GuildMember[]; roles: GuildRole[] } | null = null;

async function loadDiscord(fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache;
  const [members, roles] = await Promise.all([fetchGuildMembers(), fetchGuildRoles()]);
  cache = { at: Date.now(), members, roles };
  return cache;
}

/** Everyone holding a GSP role, in chain-of-command order (section → rank → name). */
export async function buildRoster({ fresh = false } = {}): Promise<{ entries: RosterEntry[]; roles: GuildRole[] }> {
  const { members, roles } = await loadDiscord(fresh);
  const picked = await getRankRoleSetting();
  const rankRoles = new Map(roles.filter((r) => isRankRole(r, picked)).map((r) => [r.id, r]));
  const callsigns = new Map(
    (await query<{ user_id: string; callsign: number }>(`SELECT user_id, callsign FROM roster_callsigns`)).map((r) => [
      r.user_id,
      Number(r.callsign),
    ]),
  );

  const entries: RosterEntry[] = [];
  for (const m of members) {
    if (m.user.bot) continue;
    const section = SECTIONS.find((s) => m.roles.includes(s.roleId));
    if (!section) continue;
    const rank = m.roles
      .map((id) => rankRoles.get(id))
      .filter((r): r is GuildRole => !!r)
      .sort((a, b) => b.position - a.position)[0];
    entries.push({
      userId: m.user.id,
      name: baseName(m),
      username: m.user.username,
      avatar: m.user.avatar ?? null,
      nick: m.nick ?? null,
      rank: rank?.name ?? null,
      rankPosition: rank?.position ?? -1,
      section: section.key,
      callsign: callsigns.get(m.user.id) ?? null,
    });
  }

  const sectionIndex = (k: string) => SECTIONS.findIndex((s) => s.key === k);
  entries.sort(
    (a, b) =>
      sectionIndex(a.section) - sectionIndex(b.section) ||
      b.rankPosition - a.rankPosition ||
      a.name.localeCompare(b.name),
  );
  return { entries, roles: [...roles].sort((a, b) => b.position - a.position) };
}

/* ------------------------------------------------------------------ */
/* Syncing callsigns + nicknames                                       */
/* ------------------------------------------------------------------ */

function* freeCallsigns(taken: Set<number>) {
  for (const [lo, hi] of CALLSIGN_RANGES) for (let n = lo; n <= hi; n++) if (!taken.has(n)) yield n;
}

/**
 * Gives every member on the roster a callsign and sets their nickname to "600 | Name".
 * reissue = true wipes all callsigns first and numbers everyone from 600 in chain-of-command order.
 */
export async function syncRoster({ reissue = false } = {}): Promise<SyncReport> {
  if (!env.discord.botToken) throw new Error("DISCORD_BOT_TOKEN is not set.");
  await setMeta("roster_sync_running", Date.now());
  try {
    if (reissue) await query(`DELETE FROM roster_callsigns`);
    const { entries } = await buildRoster({ fresh: true });

    // Release callsigns of people who are no longer on the roster
    const onRoster = entries.map((e) => e.userId);
    if (onRoster.length) {
      await query(`DELETE FROM roster_callsigns WHERE NOT (user_id = ANY($1::text[]))`, [onRoster]);
    } else {
      await query(`DELETE FROM roster_callsigns`);
    }

    const taken = new Set(entries.map((e) => e.callsign).filter((c): c is number => c !== null));
    const pool = freeCallsigns(taken);
    let newCallsigns = 0;
    let outOfCallsigns = 0;
    for (const e of entries) {
      if (e.callsign !== null) continue;
      const next = pool.next();
      if (next.done) {
        outOfCallsigns++;
        continue;
      }
      e.callsign = next.value;
      await query(
        `INSERT INTO roster_callsigns (user_id, callsign) VALUES ($1,$2)
         ON CONFLICT (user_id) DO UPDATE SET callsign=EXCLUDED.callsign, assigned_at=now()`,
        [e.userId, e.callsign],
      );
      newCallsigns++;
    }

    // Nicknames
    let nicknamesUpdated = 0;
    const failures: SyncReport["failures"] = [];
    for (const e of entries) {
      if (e.callsign === null) continue;
      const desired = nicknameFor(e.callsign, e.name);
      if (e.nick === desired) continue;
      try {
        await setNickname(e.userId, desired);
        nicknamesUpdated++;
      } catch (err) {
        const reason =
          err instanceof DiscordError && err.status === 403
            ? "The bot can't rename this member (server owner, or their role is above the bot's)."
            : (err as Error).message.slice(0, 160);
        failures.push({ name: `${e.callsign} | ${e.name}`, reason });
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
      outOfCallsigns,
    };
    await setMeta("roster_last_sync", report);
    return report;
  } finally {
    await query(`DELETE FROM meta WHERE key='roster_sync_running'`);
  }
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
