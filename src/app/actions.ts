"use server";

import { refresh } from "next/cache";
import { THEME_COOKIE } from "@/lib/theme";
import { query, queryOne } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { sendReportWebhook } from "@/lib/webhooks";
import { announceApplication, recordDecision } from "@/lib/applications-discord";
import type { Application } from "@/lib/data";
import {
  APPLICATION_STATUSES,
  CADET_QUESTIONS,
  REPORT_STATUSES,
  appRef,
  applicationSchema,
  reportRef,
  reportSchema,
  zodErrors,
  type FormState,
} from "@/lib/forms";

const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;

/* ------------------------------------------------------------------ */
/* Public forms                                                        */
/* ------------------------------------------------------------------ */

export async function submitApplication(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer) return { message: "Your session expired. Please log in with Discord again.", values };

  const botReady = Boolean(env.discord.botToken && env.discord.guildId);
  if (botReady && !viewer.inGuild) {
    return { message: "You must join the South Fulton Roleplay Discord before applying.", values };
  }

  const parsed = applicationSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), message: "Please fix the highlighted fields.", values };
  const d = parsed.data as Record<string, string | number>;

  if (Number(d.age) < site.minimumAge) {
    return { errors: { age: `You must be at least ${site.minimumAge} to apply.` }, values };
  }

  const open = await queryOne(
    `SELECT id FROM applications WHERE discord_id = $1 AND status IN ('pending','review') LIMIT 1`,
    [viewer.uid],
  );
  if (open) return { message: "You already have an application waiting for review. Please wait for a decision.", values };

  const answers = CADET_QUESTIONS.map((q) => ({ key: q.key, question: q.label, answer: String(d[q.key] ?? "") }));

  const row = await queryOne<Application>(
    `INSERT INTO applications (discord_id, discord_username, discord_avatar, roblox_username, age, timezone, availability, answers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [viewer.uid, viewer.username, viewer.avatar, d.roblox_username, d.age, d.timezone, d.availability, JSON.stringify(answers)],
  );
  const id = Number(row!.id);

  // Posted by the bot so the Accept / Deny buttons work (falls back to the webhook if the bot can't post).
  const ok = await announceApplication({ ...row!, answers });
  await query(`UPDATE applications SET webhook_ok = $1 WHERE id = $2`, [ok, id]);

  return { ok: true, ref: appRef(id) };
}

export async function submitReport(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer) return { message: "Your session expired. Please log in with Discord again.", values };

  const parsed = reportSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), message: "Please fix the highlighted fields.", values };
  const d = parsed.data;

  const recent = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM reports WHERE reporter_discord_id = $1 AND created_at > now() - interval '24 hours'`,
    [viewer.uid],
  );
  if (Number(recent?.n ?? 0) >= 3) {
    return { message: "You have submitted 3 reports in the last 24 hours. Please wait before submitting another.", values };
  }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO reports (reporter_discord_id, reporter_username, reporter_roblox, trooper_name, trooper_identifier,
       incident_date, location, category, description, evidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      viewer.uid,
      viewer.username,
      d.reporter_roblox,
      d.trooper_name,
      d.trooper_identifier || null,
      d.incident_date,
      d.location || null,
      d.category,
      d.description,
      d.evidence || null,
    ],
  );
  const id = Number(row!.id);

  const ok = await sendReportWebhook({
    id,
    reporterId: viewer.uid,
    reporterUsername: viewer.username,
    reporterRoblox: d.reporter_roblox,
    trooperName: d.trooper_name,
    trooperIdentifier: d.trooper_identifier || null,
    incidentDate: d.incident_date,
    location: d.location || null,
    category: d.category,
    description: d.description,
    evidence: d.evidence || null,
  });
  await query(`UPDATE reports SET webhook_ok = $1 WHERE id = $2`, [ok, id]);

  return { ok: true, ref: reportRef(id) };
}

/* ------------------------------------------------------------------ */
/* Staff actions — every one re-checks permissions server-side         */
/* ------------------------------------------------------------------ */

async function requirePermission(p: "applications" | "reports" | "content") {
  const viewer = await getViewer();
  if (!viewer || !viewer.can(p)) throw new Error("You do not have permission to do that.");
  return viewer;
}

export async function decideApplication(_: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requirePermission("applications");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status"));
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 2000);
  const notify = fd.get("notify") === "on";
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!(status in APPLICATION_STATUSES)) return { message: "Invalid status." };
  if (status === "denied" && reason.length < 5) {
    return { message: "A reason is required to deny an application.", errors: { reason: "Please give a reason for the denial (at least 5 characters)." } };
  }

  const before = await queryOne<{ status: string }>(`SELECT status FROM applications WHERE id=$1`, [id]);
  if (!before) return { message: "Application not found." };

  const result = await recordDecision({
    id,
    status: status as "pending" | "review" | "accepted" | "denied",
    reviewerId: viewer.uid,
    reviewerName: viewer.displayName,
    notes,
    reason: status === "denied" ? reason : null,
    onlyIfOpen: false,
    // Only DM when the decision actually changes, so re-saving notes doesn't DM the applicant twice.
    notify: notify && before.status !== status,
  });
  if (!result.ok) return { message: "Application not found." };

  const dm =
    result.dmSent === true
      ? " Applicant notified by DM."
      : result.dmSent === false
        ? " Could not DM the applicant (their DMs may be closed)."
        : "";
  refresh();
  return { ok: true, message: `Saved as ${APPLICATION_STATUSES[status as keyof typeof APPLICATION_STATUSES].label}.${dm}` };
}

export async function updateReport(_: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requirePermission("reports");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status"));
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 4000);
  const assign = fd.get("assign") === "on";
  if (!(status in REPORT_STATUSES)) return { message: "Invalid status." };

  const row = await queryOne(
    `UPDATE reports SET status=$1, psb_notes=$2, updated_at=now(),
       investigator_id = CASE WHEN $3 THEN $4 ELSE investigator_id END,
       investigator_name = CASE WHEN $3 THEN $5 ELSE investigator_name END
     WHERE id=$6 RETURNING id`,
    [status, notes || null, assign, viewer.uid, viewer.displayName, id],
  );
  if (!row) return { message: "Report not found." };
  refresh();
  return { ok: true, message: "Case updated." };
}

export async function saveStaffMember(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("content");
  const id = fd.get("id") ? Number(fd.get("id")) : null;
  const name = String(fd.get("name") ?? "").trim();
  const rank = String(fd.get("rank") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim();
  const bio = String(fd.get("bio") ?? "").trim().slice(0, 600);
  const photo = String(fd.get("photo_url") ?? "").trim();
  const sort = Number(fd.get("sort_order") ?? 0) || 0;
  if (!name || !rank || !title) return { message: "Name, rank and title are required." };
  if (photo && !/^(https:\/\/|\/)/.test(photo)) return { message: "Photo must be an https:// link or a /images/... path." };

  if (id) {
    await query(
      `UPDATE command_staff SET name=$1, rank=$2, title=$3, bio=$4, photo_url=$5, sort_order=$6 WHERE id=$7`,
      [name, rank, title, bio, photo || null, sort, id],
    );
  } else {
    await query(
      `INSERT INTO command_staff (name, rank, title, bio, photo_url, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, rank, title, bio, photo || null, sort],
    );
  }
  refresh();
  return { ok: true, message: id ? "Saved." : "Added to command staff." };
}

export async function deleteStaffMember(fd: FormData) {
  await requirePermission("content");
  await query(`DELETE FROM command_staff WHERE id = $1`, [Number(fd.get("id"))]);
  refresh();
}

export async function saveDivision(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("content");
  const slug = String(fd.get("slug"));
  const commander = String(fd.get("commander") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim().slice(0, 600);
  const duties = String(fd.get("duties") ?? "").trim().slice(0, 1000);
  const recruitment = fd.get("recruitment") === "open" ? "open" : "closed";
  if (!summary) return { message: "Summary is required." };
  await query(`UPDATE divisions SET commander=$1, summary=$2, duties=$3, recruitment=$4 WHERE slug=$5`, [
    commander || null,
    summary,
    duties,
    recruitment,
    slug,
  ]);
  refresh();
  return { ok: true, message: "Saved." };
}

export async function registerDiscordCommands(): Promise<FormState> {
  await requirePermission("content");
  const { registerGuildCommands } = await import("@/lib/discord-bot");
  const { SLASH_COMMANDS } = await import("@/lib/tickets");
  const { DISCIPLINE_COMMANDS } = await import("@/lib/discipline");
  try {
    const result = await registerGuildCommands([...SLASH_COMMANDS, ...DISCIPLINE_COMMANDS]);
    return {
      ok: true,
      message: `Registered ${result.length} slash commands: /claim, /close, /close-request, /rename, /support-panel, /promote, /infraction.`,
    };
  } catch (e) {
    return { message: `Discord rejected the request: ${(e as Error).message}` };
  }
}

export async function rosterSync(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("content");
  const { syncRoster } = await import("@/lib/roster");
  const reissue = fd.get("mode") === "reissue";
  if (reissue && fd.get("confirm") !== "REISSUE") {
    return { message: 'Type REISSUE in the box to confirm re-numbering everyone.' };
  }
  try {
    const r = await syncRoster({ reissue });
    refresh();
    return {
      ok: true,
      message:
        `${reissue ? "Callsigns re-issued" : "Roster synced"}: ${r.members} members, ${r.newCallsigns} new callsigns, ` +
        `${r.nicknamesUpdated} nicknames updated` +
        (r.failures.length ? `, ${r.failures.length} couldn't be renamed (see below).` : ".") +
        (r.noSpot.length ? ` ${r.noSpot.length} members have no callsign because their rank's spots are full.` : ""),
    };
  } catch (e) {
    return { message: `Sync failed: ${(e as Error).message}` };
  }
}

export async function saveAssignments(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("content");
  const { RANKS, SLOT_RANKS, saveAssignmentsData } = await import("@/lib/roster");
  const clean = (k: string) => String(fd.get(k) ?? "").trim().slice(0, 80);
  const slots: Record<string, string> = {};
  for (const r of SLOT_RANKS)
    for (let n = r.block[0]; n <= r.block[1]; n++) {
      const v = clean(`s_${n}`);
      if (v) slots[String(n)] = v;
    }
  const ranks: Record<string, string> = {};
  for (const r of RANKS) {
    if (SLOT_RANKS.some((x) => x.key === r.key)) continue;
    const v = clean(`r_${r.key}`);
    if (v) ranks[r.key] = v;
  }
  await saveAssignmentsData({ slots, ranks });
  refresh();
  return { ok: true, message: "Assignments saved — the roster is updated." };
}

/* ------------------------------------------------------------------ */
/* Notifications & profile                                             */
/* ------------------------------------------------------------------ */

export async function publishNotification(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer) return { message: "Your session expired. Please log in again.", values };
  const { NOTIFICATION_KINDS, ALERT_TYPES, createNotification, sendNotificationDMs } = await import("@/lib/notifications");
  const kind = values.kind as keyof typeof NOTIFICATION_KINDS;
  const meta = NOTIFICATION_KINDS[kind];
  if (!meta) return { message: "Pick what you're publishing.", values };
  if (!viewer.can(meta.permission)) return { message: `You don't have permission to publish ${meta.plural.toLowerCase()}.`, values };

  const errors: Record<string, string> = {};
  const alertType = kind === "alert" ? (values.alert_type as keyof typeof ALERT_TYPES) : null;
  if (kind === "alert" && (!alertType || !ALERT_TYPES[alertType])) errors.alert_type = "Choose the alert type.";
  const title = (values.title ?? "").trim();
  const body = (values.body ?? "").trim();
  if (title.length < 3) errors.title = "Add a headline.";
  if (title.length > 150) errors.title = "Keep the headline under 150 characters.";
  if (body.length < 10) errors.body = "Add the details.";
  if (body.length > 3000) errors.body = "Keep it under 3,000 characters.";
  if (Object.keys(errors).length) return { errors, values };

  const n = await createNotification({ kind, alertType, title, body, authorId: viewer.uid, authorName: viewer.displayName });
  if (values.send_dms === "on") {
    const { after } = await import("next/server");
    after(() => sendNotificationDMs(n).catch((e) => console.error("[notifications] DMs failed", e)));
  } else {
    await query(`UPDATE notifications SET dm_done=true WHERE id=$1`, [n.id]);
  }
  refresh();
  return {
    ok: true,
    ref: String(n.id),
    message: `${meta.label} published.${values.send_dms === "on" ? " DMs to subscribers are going out now." : ""}`,
  };
}

export async function removeNotification(fd: FormData) {
  const viewer = await getViewer();
  const { NOTIFICATION_KINDS, deleteNotification } = await import("@/lib/notifications");
  const id = Number(fd.get("id"));
  const row = await queryOne<{ kind: keyof typeof NOTIFICATION_KINDS }>(`SELECT kind FROM notifications WHERE id=$1`, [id]);
  if (!viewer || !row || !viewer.can(NOTIFICATION_KINDS[row.kind].permission)) throw new Error("You do not have permission to do that.");
  await deleteNotification(id);
  refresh();
}

/** Called when the notification bell is opened. */
export async function markNotificationsSeen() {
  const viewer = await getViewer();
  if (!viewer) return;
  const { markSeen } = await import("@/lib/notifications");
  await markSeen(viewer.uid, viewer.username);
}

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { message: "Your session expired. Please log in again." };
  const { savePrefs } = await import("@/lib/notifications");
  const theme = (["light", "dark", "system"] as const).find((t) => t === fd.get("theme")) ?? "light";
  const personnel = viewer.can("portal");
  await savePrefs(viewer.uid, viewer.username, {
    dm_alerts: fd.get("dm_alerts") === "on",
    dm_press: fd.get("dm_press") === "on",
    dm_info: personnel && fd.get("dm_info") === "on",
    theme,
  });
  const { cookies } = await import("next/headers");
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
  return { ok: true, message: "Settings saved." };
}
