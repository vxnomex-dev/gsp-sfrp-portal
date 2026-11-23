import "server-only";
import { query, queryOne } from "./db";

/**
 * Discord settings — which server the bot works in, and which roles/channels do what.
 * Chosen from dropdowns on Portal → Discord Setup and stored in the database, so nothing is hard-coded
 * and moving to a new server never needs a code change.
 */

export const ROLE_SLOTS = {
  ootc: { label: "Office of the Colonel", hint: "Full access to everything." },
  highCommand: { label: "High Command", hint: "Reviews applications, edits the website, posts Important Info." },
  command: { label: "Command", hint: "Reviews applications, can /promote, claims and closes any ticket." },
  supervisor: { label: "Supervisor", hint: "Handles General Support tickets. Opens the employee portal." },
  patrol: { label: "Patrol", hint: "Opens the employee portal." },
  personnel: { label: "Department Personnel", hint: "Everyone in the department. Opens the employee portal." },
  hr: { label: "Human Resources", hint: "Sees trooper reports and issues infractions." },
  press: { label: "Press Release Team", hint: "Publishes press releases." },
  communityMember: { label: "Community Member", hint: "The only role kept when someone is terminated." },
  loa: { label: "Leave of Absence", hint: "Given while someone's leave is approved, removed when it ends." },
  applicationsPing: { label: "Ping for new applications", hint: "Pinged when a cadet application comes in." },
  reportsPing: { label: "Ping for trooper reports", hint: "Pinged when someone reports a trooper." },
} as const;
export type RoleSlot = keyof typeof ROLE_SLOTS;

export const CHANNEL_SLOTS = {
  applications: { label: "Cadet applications", hint: "Where applications are posted with Accept / Deny.", category: false },
  reports: { label: "Trooper reports", hint: "Human Resources only.", category: false },
  promotions: { label: "Promotions", hint: "Where /promote announcements go.", category: false },
  infractions: { label: "Infractions", hint: "Where /infraction notices go.", category: false },
  transcripts: { label: "Ticket transcripts", hint: "A copy of every closed ticket.", category: false },
  cadetDashboard: { label: "Cadet dashboard", hint: "Accepted applicants are told to read this channel.", category: false },
  loa: { label: "Leave of absence requests", hint: "Where LOA requests are posted with Approve / Deny.", category: false },
  shiftLogs: { label: "Shift logs (optional)", hint: "A short note whenever someone goes on or off duty.", category: false },
  ticketGeneral: { label: "General Support tickets", hint: "Category new General Support tickets open in.", category: true },
  ticketDivisional: { label: "Divisional Support tickets", hint: "Category for Divisional Support tickets.", category: true },
  ticketCommand: { label: "Command Support tickets", hint: "Category for Command Support tickets.", category: true },
} as const;
export type ChannelSlot = keyof typeof CHANNEL_SLOTS;

export type DiscordConfig = {
  guildId: string;
  guildName: string;
  roles: Record<RoleSlot, string>;
  channels: Record<ChannelSlot, string>;
};

const empty = <K extends string>(keys: K[]) => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;
export const EMPTY_CONFIG: DiscordConfig = {
  guildId: "",
  guildName: "",
  roles: empty(Object.keys(ROLE_SLOTS) as RoleSlot[]),
  channels: empty(Object.keys(CHANNEL_SLOTS) as ChannelSlot[]),
};

const KEY = "discord_config";
let cache: { at: number; cfg: DiscordConfig } | null = null;

export async function getConfig(): Promise<DiscordConfig> {
  if (cache && Date.now() - cache.at < 15_000) return cache.cfg;
  let saved: Partial<DiscordConfig> = {};
  try {
    const row = await queryOne<{ value: string }>(`SELECT value FROM meta WHERE key=$1`, [KEY]);
    if (row) saved = JSON.parse(row.value);
  } catch {
    /* database not ready — act as not configured */
  }
  const cfg: DiscordConfig = {
    guildId: saved.guildId ?? "",
    guildName: saved.guildName ?? "",
    roles: { ...EMPTY_CONFIG.roles, ...(saved.roles ?? {}) },
    channels: { ...EMPTY_CONFIG.channels, ...(saved.channels ?? {}) },
  };
  // Default LOA channel for the Florida Highway Patrol server until one is picked in Discord Setup
  if (!cfg.channels.loa && cfg.guildId) cfg.channels.loa = "1574221084390064188";
  cache = { at: Date.now(), cfg };
  return cfg;
}

export async function saveConfig(cfg: DiscordConfig) {
  await query(`INSERT INTO meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [
    KEY,
    JSON.stringify(cfg),
  ]);
  cache = { at: Date.now(), cfg };
}

/** The server the bot works in. Throws a clear message if setup hasn't been done. */
export async function guildId(): Promise<string> {
  const id = (await getConfig()).guildId;
  if (!id) throw new Error("The Discord server hasn't been chosen yet — open Portal → Discord Setup.");
  return id;
}

/** Role IDs for one or more slots, skipping any that aren't set. */
export const rolesFor = (cfg: DiscordConfig, ...slots: RoleSlot[]) => slots.map((s) => cfg.roles[s]).filter(Boolean);
