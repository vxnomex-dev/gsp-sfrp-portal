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
];

const COMMAND_STAFF = [
  {
    name: "Tim Bradford",
    rank: "Colonel",
    title: "Commanding Officer",
    bio: "The Colonel holds final authority over the Georgia State Patrol — setting department policy, approving promotions and representing the Patrol to the wider South Fulton Roleplay community.",
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
      "The Patrol's dedicated DUI task force, working the late hours to take impaired and dangerous drivers off Georgia's roads.",
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
    name: "Professional Standards Bureau",
    abbreviation: "PSB",
    summary:
      "The department's internal affairs office. PSB investigates complaints against troopers and protects the integrity of the Patrol.",
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
