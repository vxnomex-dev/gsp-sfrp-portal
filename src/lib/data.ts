import "server-only";
import { query, queryOne } from "./db";

export type CommandStaffMember = {
  id: number;
  name: string;
  rank: string;
  title: string;
  bio: string;
  photo_url: string | null;
  sort_order: number;
};

export type Division = {
  slug: string;
  name: string;
  abbreviation: string;
  summary: string;
  duties: string;
  commander: string | null;
  recruitment: "open" | "closed" | "handpicked";
  restricted: boolean;
  commander_callsign: number | null;
  sort_order: number;
};

export type Application = {
  id: number;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  roblox_username: string;
  age: number;
  timezone: string;
  availability: string;
  answers: { key: string; question: string; answer: string }[];
  status: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_notes: string | null;
  webhook_ok: boolean | null;
  discord_channel_id: string | null;
  discord_message_id: string | null;
  denial_reason: string | null;
  created_at: string | Date;
  reviewed_at: string | Date | null;
};

export type Report = {
  id: number;
  reporter_discord_id: string;
  reporter_username: string;
  reporter_roblox: string;
  trooper_name: string;
  trooper_identifier: string | null;
  incident_date: string;
  location: string | null;
  category: string;
  description: string;
  evidence: string | null;
  status: string;
  investigator_id: string | null;
  investigator_name: string | null;
  psb_notes: string | null;
  webhook_ok: boolean | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const parseAnswers = (a: Application): Application => ({
  ...a,
  answers: typeof a.answers === "string" ? JSON.parse(a.answers) : a.answers,
});

export const getCommandStaff = () =>
  query<CommandStaffMember>(`SELECT * FROM command_staff ORDER BY sort_order, id`);

export const getDivisions = () => query<Division>(`SELECT * FROM divisions ORDER BY sort_order, slug`);

export async function listApplications(status?: string) {
  const rows = status
    ? await query<Application>(`SELECT * FROM applications WHERE status = $1 ORDER BY created_at DESC`, [status])
    : await query<Application>(`SELECT * FROM applications ORDER BY created_at DESC`);
  return rows.map(parseAnswers);
}

export async function getApplication(id: number) {
  const row = await queryOne<Application>(`SELECT * FROM applications WHERE id = $1`, [id]);
  return row ? parseAnswers(row) : null;
}

export const getMyApplications = (discordId: string) =>
  query<Pick<Application, "id" | "status" | "created_at">>(
    `SELECT id, status, created_at FROM applications WHERE discord_id = $1 ORDER BY created_at DESC`,
    [discordId],
  );

export const listReports = (status?: string) =>
  status
    ? query<Report>(`SELECT * FROM reports WHERE status = $1 ORDER BY created_at DESC`, [status])
    : query<Report>(`SELECT * FROM reports ORDER BY created_at DESC`);

export const getReport = (id: number) => queryOne<Report>(`SELECT * FROM reports WHERE id = $1`, [id]);

export async function getCounts() {
  const row = await queryOne<{ apps_pending: number; reports_open: number }>(
    `SELECT
      (SELECT count(*)::int FROM applications WHERE status IN ('pending','review')) AS apps_pending,
      (SELECT count(*)::int FROM reports WHERE status IN ('open','investigating')) AS reports_open`,
  );
  return { appsPending: Number(row?.apps_pending ?? 0), reportsOpen: Number(row?.reports_open ?? 0) };
}
