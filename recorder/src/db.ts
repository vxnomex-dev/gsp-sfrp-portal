import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (use the same database as the website).");

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
  max: 3,
});

export async function q<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await pool.query<T>(text, params)).rows;
}

export type RecordingRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  channel_name: string | null;
  requester_id: string;
  requester_name: string;
  reason: string | null;
  status: "requested" | "recording" | "stop_requested" | "processing" | "done" | "failed";
  status_reason: string | null;
  stopped_by: string | null;
};

export async function setStatus(id: number, status: RecordingRow["status"], extra: Record<string, unknown> = {}) {
  const cols = Object.keys(extra);
  const sets = ["status=$2", "updated_at=now()", ...cols.map((c, i) => `${c}=$${i + 3}`)];
  await q(`UPDATE recordings SET ${sets.join(", ")} WHERE id=$1`, [id, status, ...cols.map((c) => extra[c])]);
}

/** Recordings channel picked on Portal → Discord Setup. */
export async function recordingsChannelId(): Promise<string | null> {
  const rows = await q<{ value: string }>(`SELECT value FROM meta WHERE key='discord_config'`);
  if (!rows[0]) return null;
  try {
    return (JSON.parse(rows[0].value) as { channels?: { recordings?: string } }).channels?.recordings || null;
  } catch {
    return null;
  }
}

export const heartbeat = () =>
  q(`INSERT INTO meta (key, value) VALUES ('recorder_heartbeat', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [
    new Date().toISOString(),
  ]);
