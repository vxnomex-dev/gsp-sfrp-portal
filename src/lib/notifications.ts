import "server-only";
import { query, queryOne } from "./db";
import { env } from "./env";
import { site } from "./site";
import { clean, container, divider, text, unix, type Component } from "./components";
import { sendDirectMessageV2 } from "./discord-bot";
import { fetchMemberRoles } from "./discord";
import { resolveAccess, type Permission } from "./permissions";

/* ------------------------------------------------------------------ */
/* Kinds                                                               */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_KINDS = {
  alert: {
    label: "Statewide Alert",
    plural: "Statewide Alerts",
    permission: "alerts" as Permission,
    pref: "dm_alerts",
    personnelOnly: false,
    issuer: "the Office of the Colonel",
    blurb: "Emergency releases from the Office of the Colonel — Amber, Silver and Blue alerts and public threats.",
  },
  press: {
    label: "Press Release",
    plural: "Press Releases",
    permission: "press" as Permission,
    pref: "dm_press",
    personnelOnly: false,
    issuer: "the GSP Press Release Team",
    blurb: "Updates for the public about calls and incidents the Patrol has handled.",
  },
  info: {
    label: "Important Info",
    plural: "Important Info",
    permission: "notices" as Permission,
    pref: "dm_info",
    personnelOnly: true,
    issuer: "GSP High Command",
    blurb: "Important information for department personnel. Only members of the Patrol can see these.",
  },
} as const;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export const ALERT_TYPES = {
  amber: "Amber Alert",
  silver: "Silver Alert",
  blue: "Blue Alert (BOLO)",
  threat: "Public Threat",
} as const;
export type AlertType = keyof typeof ALERT_TYPES;

export type Notification = {
  id: number;
  kind: NotificationKind;
  alert_type: AlertType | null;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  dm_sent: number;
  dm_failed: number;
  dm_done: boolean;
  created_at: string | Date;
};

/** The badge shown on a notification, e.g. "Amber Alert" or "Press Release". */
export function badgeFor(n: Pick<Notification, "kind" | "alert_type">) {
  if (n.kind === "alert" && n.alert_type && ALERT_TYPES[n.alert_type]) return ALERT_TYPES[n.alert_type];
  return NOTIFICATION_KINDS[n.kind]?.label ?? "Notice";
}

/** Kinds a viewer may read: everyone gets alerts + press; personnel also get important info. */
export function visibleKinds(perms: Permission[] | null): NotificationKind[] {
  return perms?.includes("portal") ? ["alert", "press", "info"] : ["alert", "press"];
}

export async function listNotifications(kinds: NotificationKind[], limit = 50): Promise<Notification[]> {
  if (!kinds.length) return [];
  return query<Notification>(
    `SELECT * FROM notifications WHERE kind = ANY($1::text[]) ORDER BY created_at DESC, id DESC LIMIT $2`,
    [kinds, limit],
  );
}

/* ------------------------------------------------------------------ */
/* User preferences                                                    */
/* ------------------------------------------------------------------ */

export type Theme = "light" | "dark" | "system";
export type UserPrefs = {
  dm_alerts: boolean;
  dm_press: boolean;
  dm_info: boolean;
  theme: Theme;
  notif_seen_at: string | Date | null;
};
export const DEFAULT_PREFS: UserPrefs = { dm_alerts: false, dm_press: false, dm_info: false, theme: "light", notif_seen_at: null };

export async function getPrefs(userId: string): Promise<UserPrefs> {
  const row = await queryOne<UserPrefs>(
    `SELECT dm_alerts, dm_press, dm_info, theme, notif_seen_at FROM user_prefs WHERE user_id=$1`,
    [userId],
  );
  return row ?? DEFAULT_PREFS;
}

export async function savePrefs(userId: string, username: string, p: Omit<UserPrefs, "notif_seen_at">) {
  await query(
    `INSERT INTO user_prefs (user_id, username, dm_alerts, dm_press, dm_info, theme, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (user_id) DO UPDATE SET username=EXCLUDED.username, dm_alerts=EXCLUDED.dm_alerts, dm_press=EXCLUDED.dm_press,
       dm_info=EXCLUDED.dm_info, theme=EXCLUDED.theme, updated_at=now()`,
    [userId, username, p.dm_alerts, p.dm_press, p.dm_info, p.theme],
  );
}

export async function markSeen(userId: string, username: string) {
  await query(
    `INSERT INTO user_prefs (user_id, username, notif_seen_at) VALUES ($1,$2, now())
     ON CONFLICT (user_id) DO UPDATE SET notif_seen_at=now()`,
    [userId, username],
  );
}

/* ------------------------------------------------------------------ */
/* Publishing + DMs                                                    */
/* ------------------------------------------------------------------ */

export async function createNotification(n: {
  kind: NotificationKind;
  alertType: AlertType | null;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
}) {
  return (await queryOne<Notification>(
    `INSERT INTO notifications (kind, alert_type, title, body, author_id, author_name)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [n.kind, n.kind === "alert" ? n.alertType : null, n.title, n.body, n.authorId, n.authorName],
  ))!;
}

export async function deleteNotification(id: number) {
  await query(`DELETE FROM notifications WHERE id=$1`, [id]);
}

export const notificationUrl = (id: number) => `${env.baseUrl}/notifications#n-${id}`;

function notificationDM(n: Notification): Component[] {
  const t = unix(new Date(n.created_at));
  const meta = NOTIFICATION_KINDS[n.kind];
  return [
    container([
      text(`### ${clean(badgeFor(n), 60)}\n**${clean(n.title, 200)}**`),
      text(clean(n.body, 3000)),
      text(`-# Issued by ${meta.issuer} on <t:${t}:D> at <t:${t}:t>.`),
      { type: 1, components: [{ type: 2, style: 5, label: "View on website", url: notificationUrl(n.id) }] },
      text(`-# You're receiving this because you turned on ${meta.plural} DMs at ${clean(site.name, 60)}. Change this on your profile.`),
      divider(),
    ]),
  ];
}

/** DMs everyone who opted in to this kind. Runs in the background after publishing. */
export async function sendNotificationDMs(n: Notification) {
  const meta = NOTIFICATION_KINDS[n.kind];
  const users = await query<{ user_id: string }>(`SELECT user_id FROM user_prefs WHERE ${meta.pref} = true`);
  let sent = 0;
  let failed = 0;
  const components = notificationDM(n);
  for (const { user_id } of users) {
    try {
      // Important info stays inside the department: re-check they're still personnel
      if (meta.personnelOnly) {
        const roles = await fetchMemberRoles(user_id);
        if (!roles || !resolveAccess(roles).permissions.includes("portal")) continue;
      }
      if (await sendDirectMessageV2(user_id, components)) sent++;
      else failed++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 400)); // stay under Discord's DM rate limits
    if ((sent + failed) % 10 === 0) {
      await query(`UPDATE notifications SET dm_sent=$1, dm_failed=$2 WHERE id=$3`, [sent, failed, n.id]);
    }
  }
  await query(`UPDATE notifications SET dm_sent=$1, dm_failed=$2, dm_done=true WHERE id=$3`, [sent, failed, n.id]);
}
