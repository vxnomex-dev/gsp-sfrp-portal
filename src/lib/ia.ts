import "server-only";
import { query, queryOne } from "./db";
import { buildRoster, RANKS, type RosterEntry } from "./roster";
import { fmtCallsign, parseCallsign } from "./callsign";
import type { Report } from "./data";

/**
 * Internal Affairs: cases against employees and the employee file (every case, infraction and promotion
 * on record for a Discord account — kept even after someone is terminated or leaves the department).
 */

import type { Finding } from "./ia-constants";
export * from "./ia-constants";
const OPEN_FINDINGS: Finding[] = ["open", "investigating"];

export type IaCase = {
  id: number;
  report_id: number | null;
  subject_id: string;
  subject_name: string;
  subject_callsign: string | null;
  subject_rank: string | null;
  reporter_username: string | null;
  reporter_discord_id: string | null;
  reporter_roblox: string | null;
  incident_date: string | null;
  location: string | null;
  category: string | null;
  reason: string;
  complainant_statement: string | null;
  trooper_statement: string | null;
  witness_statements: string | null;
  evidence: string | null;
  recording_url: string | null;
  finding: Finding;
  outcome: string;
  outcome_details: string | null;
  investigator_notes: string | null;
  investigator_id: string;
  investigator_name: string;
  created_at: string | Date;
  updated_at: string | Date | null;
  closed_at: string | Date | null;
};

/* ---------------- Reading ---------------- */

export const getCase = (id: number) =>
  Number.isInteger(id) && id > 0 ? queryOne<IaCase>(`SELECT * FROM ia_cases WHERE id=$1`, [id]) : Promise.resolve(null);

export async function listCases(filter: "active" | "closed" | "all" | "mine", viewerId: string) {
  if (filter === "active") return query<IaCase>(`SELECT * FROM ia_cases WHERE finding = ANY($1::text[]) ORDER BY id DESC LIMIT 300`, [OPEN_FINDINGS]);
  if (filter === "closed") return query<IaCase>(`SELECT * FROM ia_cases WHERE NOT (finding = ANY($1::text[])) ORDER BY id DESC LIMIT 300`, [OPEN_FINDINGS]);
  if (filter === "mine") return query<IaCase>(`SELECT * FROM ia_cases WHERE investigator_id = $1 ORDER BY id DESC LIMIT 300`, [viewerId]);
  return query<IaCase>(`SELECT * FROM ia_cases ORDER BY id DESC LIMIT 300`);
}

export const casesForReport = (reportId: number) =>
  query<{ id: number; finding: Finding }>(`SELECT id, finding FROM ia_cases WHERE report_id=$1 ORDER BY id`, [reportId]);

/** Reports that don't have an IA case yet (newest first). */
export const reportsWithoutCase = () =>
  query<Report>(
    `SELECT r.* FROM reports r WHERE NOT EXISTS (SELECT 1 FROM ia_cases c WHERE c.report_id = r.id)
     AND r.status IN ('open','investigating') ORDER BY r.id DESC LIMIT 50`,
  );

export async function iaCounts() {
  const rows = await query<{ open: number; waiting: number }>(
    `SELECT (SELECT count(*)::int FROM ia_cases WHERE finding = ANY($1::text[])) AS open,
            (SELECT count(*)::int FROM reports r WHERE r.status IN ('open','investigating')
               AND NOT EXISTS (SELECT 1 FROM ia_cases c WHERE c.report_id = r.id)) AS waiting`,
    [OPEN_FINDINGS],
  ).catch(() => [{ open: 0, waiting: 0 }]);
  return rows[0] ?? { open: 0, waiting: 0 };
}

/* ---------------- Employees ---------------- */

export type EmployeeOption = { id: string; name: string; callsign: string | null; rank: string | null; label: string };

const rankLabel = (key: string | null) => RANKS.find((r) => r.key === key)?.label ?? null;
const toOption = (e: RosterEntry): EmployeeOption => {
  const callsign = e.callsign === null ? null : fmtCallsign(e.callsign);
  const rank = rankLabel(e.rank);
  return { id: e.userId, name: e.name, callsign, rank, label: [callsign, e.name].filter(Boolean).join(" | ") + (rank ? ` — ${rank}` : "") };
};

/** Everyone currently on the roster, for the "Employee" picker. */
export async function currentEmployees(): Promise<EmployeeOption[]> {
  const roster = await buildRoster()
    .then((r) => r.entries)
    .catch(() => [] as RosterEntry[]);
  return roster.map(toOption);
}

/** Best guess at which employee a public report is about, from the name / callsign the reporter typed. */
export function guessEmployee(employees: EmployeeOption[], report: Pick<Report, "trooper_name" | "trooper_identifier">) {
  const hay = `${report.trooper_name} ${report.trooper_identifier ?? ""}`.toLowerCase();
  const typed = hay.match(/\b[3-6]\d{2}\b/)?.[0] ?? hay.match(/\b[1-4]\d{3}\b/)?.[0] ?? hay.match(/c-?\s?\d{1,3}\b/)?.[0];
  const seat = typed ? parseCallsign(typed) : null;
  if (seat) {
    const hit = employees.find((e) => e.callsign && parseCallsign(e.callsign) === seat);
    if (hit) return hit;
  }
  const words = hay.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  let best: EmployeeOption | null = null;
  let bestScore = 0;
  for (const e of employees) {
    const name = e.name.toLowerCase();
    const score = words.filter((w) => name.includes(w)).length;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

export type FileSummary = {
  id: string;
  name: string;
  cases: number;
  open: number;
  sustained: number;
  infractions: number;
  last: string | Date;
};

/** Every employee who has anything on file, newest activity first. */
export async function employeeFiles(): Promise<FileSummary[]> {
  return query<FileSummary>(
    `WITH people AS (
       SELECT subject_id AS id, subject_name AS name, created_at FROM ia_cases
       UNION ALL
       SELECT user_id, user_name, created_at FROM infractions
     )
     SELECT p.id,
            (SELECT name FROM people x WHERE x.id = p.id ORDER BY x.created_at DESC LIMIT 1) AS name,
            (SELECT count(*)::int FROM ia_cases c WHERE c.subject_id = p.id) AS cases,
            (SELECT count(*)::int FROM ia_cases c WHERE c.subject_id = p.id AND c.finding = ANY($1::text[])) AS open,
            (SELECT count(*)::int FROM ia_cases c WHERE c.subject_id = p.id AND c.finding = 'sustained') AS sustained,
            (SELECT count(*)::int FROM infractions i WHERE i.user_id = p.id AND i.status <> 'voided') AS infractions,
            max(p.created_at) AS last
     FROM people p GROUP BY p.id ORDER BY max(p.created_at) DESC LIMIT 500`,
    [OPEN_FINDINGS],
  );
}

export type FileInfraction = {
  id: number;
  kind: string;
  reason: string;
  policy: string | null;
  duration: string | null;
  issuer_name: string;
  status: string;
  void_reason: string | null;
  created_at: string | Date;
};
export type FilePromotion = {
  id: number;
  old_role_id: string;
  new_role_id: string;
  reason: string;
  old_callsign: number | null;
  new_callsign: number | null;
  issuer_name: string;
  created_at: string | Date;
};

/** Everything on record for one Discord account. `current` is null if they're no longer on the roster. */
export async function employeeFile(id: string) {
  const [cases, infractions, promotions, employees] = await Promise.all([
    query<IaCase>(`SELECT * FROM ia_cases WHERE subject_id=$1 ORDER BY id DESC`, [id]),
    query<FileInfraction>(
      `SELECT id, kind, reason, policy, duration, issuer_name, status, void_reason, created_at FROM infractions WHERE user_id=$1 ORDER BY id DESC`,
      [id],
    ),
    query<FilePromotion>(
      `SELECT id, old_role_id, new_role_id, reason, old_callsign, new_callsign, issuer_name, created_at FROM promotions WHERE user_id=$1 ORDER BY id DESC`,
      [id],
    ).catch(() => []),
    currentEmployees(),
  ]);
  const current = employees.find((e) => e.id === id) ?? null;
  const name = current?.name ?? cases[0]?.subject_name ?? (await queryOne<{ user_name: string }>(`SELECT user_name FROM infractions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`, [id]))?.user_name ?? null;
  return { id, name, current, cases, infractions, promotions };
}

/* ---------------- Writing ---------------- */

export type CaseInput = {
  report_id: number | null;
  subject_id: string;
  subject_name: string;
  subject_callsign: string | null;
  subject_rank: string | null;
  reporter_username: string | null;
  reporter_discord_id: string | null;
  reporter_roblox: string | null;
  incident_date: string | null;
  location: string | null;
  category: string | null;
  reason: string;
  complainant_statement: string | null;
  trooper_statement: string | null;
  witness_statements: string | null;
  evidence: string | null;
  recording_url: string | null;
  finding: Finding;
  outcome: string;
  outcome_details: string | null;
  investigator_notes: string | null;
};

const COLS = [
  "report_id",
  "subject_id",
  "subject_name",
  "subject_callsign",
  "subject_rank",
  "reporter_username",
  "reporter_discord_id",
  "reporter_roblox",
  "incident_date",
  "location",
  "category",
  "reason",
  "complainant_statement",
  "trooper_statement",
  "witness_statements",
  "evidence",
  "recording_url",
  "finding",
  "outcome",
  "outcome_details",
  "investigator_notes",
] as const;

/** Keeps the linked public report's status in step with the case. */
async function syncReport(c: IaCase) {
  if (!c.report_id) return;
  const status =
    c.finding === "sustained"
      ? "sustained"
      : c.finding === "not_sustained" || c.finding === "exonerated" || c.finding === "unfounded"
        ? "not_sustained"
        : c.finding === "closed"
          ? "closed"
          : "investigating";
  await query(
    `UPDATE reports SET status=$1, investigator_id=COALESCE(investigator_id,$2), investigator_name=COALESCE(investigator_name,$3), updated_at=now() WHERE id=$4`,
    [status, c.investigator_id, c.investigator_name, c.report_id],
  );
}

export async function createCase(input: CaseInput, investigator: { id: string; name: string }) {
  const values = COLS.map((k) => input[k]);
  const c = (await queryOne<IaCase>(
    `INSERT INTO ia_cases (${COLS.join(", ")}, investigator_id, investigator_name, closed_at)
     VALUES (${COLS.map((_, i) => `$${i + 1}`).join(", ")}, $${COLS.length + 1}, $${COLS.length + 2},
             CASE WHEN $${COLS.indexOf("finding") + 1} = ANY($${COLS.length + 3}::text[]) THEN NULL ELSE now() END)
     RETURNING *`,
    [...values, investigator.id, investigator.name, OPEN_FINDINGS],
  ))!;
  await syncReport(c);
  return c;
}

export async function updateCase(id: number, input: CaseInput) {
  const sets = COLS.map((k, i) => `${k}=$${i + 2}`).join(", ");
  const c = await queryOne<IaCase>(
    `UPDATE ia_cases SET ${sets}, updated_at=now(),
       closed_at = CASE WHEN $${COLS.indexOf("finding") + 2} = ANY($${COLS.length + 2}::text[]) THEN NULL ELSE COALESCE(closed_at, now()) END
     WHERE id=$1 RETURNING *`,
    [id, ...COLS.map((k) => input[k]), OPEN_FINDINGS],
  );
  if (c) await syncReport(c);
  return c;
}

export const deleteCase = (id: number) => query(`DELETE FROM ia_cases WHERE id=$1`, [id]);
