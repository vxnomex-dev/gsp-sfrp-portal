import "server-only";
import { query, queryOne } from "./db";
import { getConfig } from "./config";
import { container, text } from "./components";
import { postChannelMessage } from "./discord-bot";
import { RANKS, buildRoster, rankForRoles, type RankKey, type RosterEntry } from "./roster";
import { fmtCallsign } from "./callsign";

export type Shift = {
  id: number;
  user_id: string;
  user_name: string;
  started_at: string | Date;
  ended_at: string | Date | null;
  ended_by_id: string | null;
  ended_by_name: string | null;
};

/** "3h 25m", "12m", "0m" */
export function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const secondsOf = (sh: Pick<Shift, "started_at" | "ended_at">) =>
  ((sh.ended_at ? new Date(sh.ended_at).getTime() : Date.now()) - new Date(sh.started_at).getTime()) / 1000;

export async function activeShift(userId: string) {
  return queryOne<Shift>(`SELECT * FROM shifts WHERE user_id=$1 AND ended_at IS NULL`, [userId]);
}

export async function recentShifts(userId: string, limit = 10) {
  return query<Shift>(`SELECT * FROM shifts WHERE user_id=$1 ORDER BY started_at DESC LIMIT $2`, [userId, limit]);
}

/** Total time on duty since the last wipe (the running shift included). */
export async function totalSeconds(userId: string) {
  const rows = await query<Shift>(`SELECT started_at, ended_at FROM shifts WHERE user_id=$1`, [userId]);
  return rows.reduce((n, r) => n + secondsOf(r as Shift), 0);
}

/** Time from finished shifts only (the running shift is counted live on the page). */
export async function completedSeconds(userId: string) {
  const rows = await query<Shift>(`SELECT started_at, ended_at FROM shifts WHERE user_id=$1 AND ended_at IS NOT NULL`, [userId]);
  return rows.reduce((n, r) => n + secondsOf(r as Shift), 0);
}

/** Everyone's totals and who is on duty right now. */
export async function shiftBoard() {
  const rows = await query<Shift>(`SELECT * FROM shifts`);
  const by = new Map<string, { total: number; completed: number; active: Shift | null; count: number }>();
  for (const r of rows) {
    const cur = by.get(r.user_id) ?? { total: 0, completed: 0, active: null, count: 0 };
    cur.total += secondsOf(r);
    if (r.ended_at) cur.completed += secondsOf(r);
    cur.count++;
    if (!r.ended_at) cur.active = r;
    by.set(r.user_id, cur);
  }
  return by;
}

async function logShift(textLine: string) {
  const channel = (await getConfig()).channels.shiftLogs;
  if (!channel) return;
  await postChannelMessage(channel, { components: [container([text(textLine)], false)] }).catch((e) =>
    console.error("[shifts] couldn't post to the shift log", e),
  );
}

export async function startShift(userId: string, name: string) {
  const existing = await activeShift(userId);
  if (existing) return { ok: false as const, message: "You're already on duty." };
  const sh = (await queryOne<Shift>(`INSERT INTO shifts (user_id, user_name) VALUES ($1,$2) RETURNING *`, [userId, name]))!;
  await logShift(`<@${userId}> is now **on duty**.`);
  return { ok: true as const, shift: sh };
}

export async function endShift(userId: string, by?: { id: string; name: string }) {
  const sh = await queryOne<Shift>(
    `UPDATE shifts SET ended_at=now(), ended_by_id=$2, ended_by_name=$3 WHERE user_id=$1 AND ended_at IS NULL RETURNING *`,
    [userId, by?.id ?? null, by?.name ?? null],
  );
  if (!sh) return { ok: false as const, message: "Not on duty." };
  const length = fmtDuration(secondsOf(sh));
  await logShift(
    by && by.id !== userId
      ? `<@${userId}> was taken **off duty** by <@${by.id}> after ${length}.`
      : `<@${userId}> is now **off duty** after ${length}.`,
  );
  return { ok: true as const, shift: sh, length };
}

/** Clears shift time. Anyone on duty stays on duty, but their clock restarts from now. */
export async function wipeShifts(userIds: string[]) {
  if (!userIds.length) return 0;
  const del = await query<{ id: number }>(
    `DELETE FROM shifts WHERE user_id = ANY($1::text[]) AND ended_at IS NOT NULL RETURNING id`,
    [userIds],
  );
  await query(`UPDATE shifts SET started_at=now() WHERE user_id = ANY($1::text[]) AND ended_at IS NULL`, [userIds]);
  return del.length;
}

export async function deleteShift(id: number) {
  return queryOne<Shift>(`DELETE FROM shifts WHERE id=$1 RETURNING *`, [id]);
}

/* ------------------------------------------------------------------ */
/* Who may manage whom                                                 */
/* ------------------------------------------------------------------ */

const ORDER = RANKS.map((r) => r.key) as RankKey[];
const idx = (k: RankKey | null) => (k ? ORDER.indexOf(k) : ORDER.length);

/**
 * The Office of the Colonel manages everyone. Other supervisory staff manage members ranked below them
 * (members with no rank yet, e.g. cadets, count as below everyone).
 */
export async function managerScope(manager: { uid: string; roles: string[]; can: (p: "shifts") => boolean }) {
  if (!manager.can("shifts")) return null;
  const cfg = await getConfig();
  const isOotc = !!cfg.roles.ootc && manager.roles.includes(cfg.roles.ootc);
  const myRank = await rankForRoles(manager.roles);
  return {
    isOotc,
    myRank,
    canManage(target: Pick<RosterEntry, "userId" | "rank">) {
      if (isOotc) return true;
      if (target.userId === manager.uid) return false;
      return myRank !== null && idx(myRank) < idx(target.rank);
    },
  };
}

export async function rosterWithShifts() {
  const [{ entries }, board] = await Promise.all([buildRoster(), shiftBoard()]);
  return entries.map((e) => {
    const b = board.get(e.userId);
    return {
      ...e,
      callsignLabel: e.callsign !== null ? fmtCallsign(e.callsign) : null,
      rankLabel: e.rank ? RANKS.find((r) => r.key === e.rank)!.label : "No rank",
      total: b?.total ?? 0,
      completed: b?.completed ?? 0,
      shifts: b?.count ?? 0,
      activeSince: b?.active ? new Date(b.active.started_at).toISOString() : null,
    };
  });
}
