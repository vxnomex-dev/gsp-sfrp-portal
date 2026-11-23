type Client = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };

export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    discord_id TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_avatar TEXT,
    roblox_username TEXT NOT NULL,
    age INTEGER NOT NULL,
    timezone TEXT NOT NULL,
    availability TEXT NOT NULL,
    answers JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id TEXT,
    reviewer_name TEXT,
    review_notes TEXT,
    webhook_ok BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS applications_discord_idx ON applications (discord_id)`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS discord_channel_id TEXT`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS discord_message_id TEXT`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS denial_reason TEXT`,
  `CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_discord_id TEXT NOT NULL,
    reporter_username TEXT NOT NULL,
    reporter_roblox TEXT NOT NULL,
    trooper_name TEXT NOT NULL,
    trooper_identifier TEXT,
    incident_date TEXT NOT NULL,
    location TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    investigator_id TEXT,
    investigator_name TEXT,
    psb_notes TEXT,
    webhook_ok BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_discord_id)`,
  `CREATE TABLE IF NOT EXISTS command_staff (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    rank TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS divisions (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    summary TEXT NOT NULL,
    duties TEXT NOT NULL DEFAULT '',
    commander TEXT,
    recruitment TEXT NOT NULL DEFAULT 'closed',
    restricted BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
  // Professional Standards Bureau was renamed to Human Resources
  `UPDATE divisions SET name='Human Resources', abbreviation='HR',
     summary=replace(summary, 'PSB investigates', 'HR investigates')
   WHERE slug='psb' AND name='Professional Standards Bureau'`,
  `CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    channel_id TEXT UNIQUE,
    opener_id TEXT NOT NULL,
    opener_name TEXT NOT NULL,
    inquiry TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    claimed_by_id TEXT,
    claimed_by_name TEXT,
    closed_by_id TEXT,
    closed_by_name TEXT,
    close_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS roster_callsigns (
    user_id TEXT PRIMARY KEY,
    callsign INTEGER NOT NULL UNIQUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS channel_name TEXT`,
  `CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    old_role_id TEXT NOT NULL,
    new_role_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    old_callsign INTEGER,
    new_callsign INTEGER,
    issuer_id TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS infractions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    reason TEXT NOT NULL,
    duration TEXT,
    issuer_id TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    voided_by_id TEXT,
    voided_by_name TEXT,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    removed_roles JSONB,
    channel_id TEXT,
    message_id TEXT,
    thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS infractions_user_idx ON infractions (user_id)`,
  `ALTER TABLE infractions ADD COLUMN IF NOT EXISTS policy TEXT`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    alert_type TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    dm_sent INTEGER NOT NULL DEFAULT 0,
    dm_failed INTEGER NOT NULL DEFAULT 0,
    dm_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC)`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS discord_message_id TEXT`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    ended_by_id TEXT,
    ended_by_name TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_active ON shifts (user_id) WHERE ended_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS shifts_user_idx ON shifts (user_id)`,
  `CREATE TABLE IF NOT EXISTS loa_requests (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    decided_by_id TEXT,
    decided_by_name TEXT,
    decision_reason TEXT,
    decided_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    role_given BOOLEAN NOT NULL DEFAULT false,
    channel_id TEXT,
    message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    dm_alerts BOOLEAN NOT NULL DEFAULT false,
    dm_press BOOLEAN NOT NULL DEFAULT false,
    dm_info BOOLEAN NOT NULL DEFAULT false,
    theme TEXT NOT NULL DEFAULT 'light',
    notif_seen_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS tickets_open_idx ON tickets (opener_id, kind, status)`,
];

const COMMAND_STAFF = [
  {
    name: "Tim Bradford",
    rank: "Colonel",
    title: "Commanding Officer",
    bio: "The Colonel holds final authority over the Florida Highway Patrol — setting department policy, approving promotions and representing the Patrol to the wider Florida State Roleplay community.",
  },
  {
    name: "Ryan Callahan",
    rank: "Lieutenant Colonel",
    title: "Deputy Commander",
    bio: "Assists the Colonel in leading the department, overseeing day-to-day operations, trooper standards and the readiness of every unit on the road.",
  },
  {
    name: "Jacob Everson",
    rank: "Lieutenant Colonel",
    title: "Deputy Commander",
    bio: "Assists the Colonel in leading the department, overseeing administration, training, discipline and the Patrol's specialized divisions.",
  },
];

const DIVISIONS = [
  {
    slug: "nighthawks",
    name: "Nighthawks",
    abbreviation: "NH",
    summary:
      "The Patrol's dedicated DUI task force, working the late hours to take impaired and dangerous drivers off Florida's roads.",
    duties:
      "Impaired-driving enforcement\nSobriety checkpoints and saturation patrols\nNighttime high-visibility enforcement\nSupport to troopers on DUI investigations",
    restricted: false,
  },
  {
    slug: "csu",
    name: "Crime Suppression Unit",
    abbreviation: "CSU",
    summary:
      "A proactive enforcement team deployed to high-crime areas to disrupt criminal activity before it reaches the highway.",
    duties:
      "Targeted saturation patrols\nPursuit and apprehension of violent offenders\nSupport to local agencies during crime surges\nHigh-visibility deterrence operations",
    restricted: false,
  },
  {
    slug: "srt",
    name: "Special Response Team",
    abbreviation: "SRT",
    summary:
      "The Patrol's tactical element, called in for high-risk situations that go beyond the scope of a standard patrol response.",
    duties:
      "High-risk warrant service\nBarricaded subjects and hostage situations\nActive threat response\nDignitary and event security",
    restricted: false,
  },
  {
    slug: "ciu",
    name: "Criminal Interdiction Unit",
    abbreviation: "CIU",
    summary:
      "Specialists in detecting and stopping the movement of narcotics, weapons and contraband along the state's highways.",
    duties:
      "Highway drug and contraband interdiction\nAdvanced vehicle search techniques\nStolen vehicle recovery\nCriminal indicator recognition on traffic stops",
    restricted: false,
  },
  {
    slug: "psb",
    name: "Human Resources",
    abbreviation: "HR",
    summary:
      "The department's internal affairs office. HR investigates complaints against troopers and protects the integrity of the Patrol.",
    duties:
      "Investigation of public complaints\nInternal misconduct investigations\nPolicy compliance reviews\nRecommendations for corrective action",
    restricted: true,
  },
];

export async function seedDefaults(client: Client) {
  const seeded = await client.query(`SELECT value FROM meta WHERE key = 'seeded_v1'`);
  if (seeded.length) return;
  const staff = await client.query(`SELECT count(*)::int AS n FROM command_staff`);
  if (Number(staff[0]?.n ?? 0) === 0) {
    for (const [i, s] of COMMAND_STAFF.entries()) {
      await client.query(
        `INSERT INTO command_staff (name, rank, title, bio, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [s.name, s.rank, s.title, s.bio, i],
      );
    }
  }
  for (const [i, d] of DIVISIONS.entries()) {
    await client.query(
      `INSERT INTO divisions (slug, name, abbreviation, summary, duties, commander, recruitment, restricted, sort_order)
       VALUES ($1,$2,$3,$4,$5,NULL,'closed',$6,$7) ON CONFLICT (slug) DO NOTHING`,
      [d.slug, d.name, d.abbreviation, d.summary, d.duties, d.restricted, i],
    );
  }
  await client.query(`INSERT INTO meta (key, value) VALUES ('seeded_v1', 'true') ON CONFLICT DO NOTHING`);
}

/**
 * One-time fresh start for the move from the Georgia State Patrol (South Fulton Roleplay) to the
 * Florida Highway Patrol (Florida State Roleplay): clears every record from the old server.
 * Command staff and division pages are kept (edit them in the portal).
 */
export async function fhpReset(client: Client) {
  const claimed = await client.query(
    `INSERT INTO meta (key, value) VALUES ('reset_fhp_v1', now()::text) ON CONFLICT (key) DO NOTHING RETURNING key`,
  );
  if (!claimed.length) return; // already done (or another server instance is doing it)
  await client.query(
    `TRUNCATE applications, reports, infractions, promotions, tickets, notifications, roster_callsigns, user_prefs RESTART IDENTITY`,
  );
  await client.query(
    `DELETE FROM meta WHERE key IN ('roster_assignments', 'roster_last_sync', 'roster_sync_running', 'discord_config')`,
  );
  // Rename the agency in page text that's already in the database
  for (const [table, cols] of [
    ["command_staff", ["title", "bio"]],
    ["divisions", ["summary", "duties"]],
  ] as const) {
    for (const col of cols) {
      await client.query(
        `UPDATE ${table} SET ${col} = replace(replace(replace(replace(${col}, 'Georgia State Patrol', 'Florida Highway Patrol'), 'South Fulton Roleplay', 'Florida State Roleplay'), 'Georgia''s roads', 'Florida''s roads'), 'GSP', 'FHP')`,
      );
    }
  }
}
