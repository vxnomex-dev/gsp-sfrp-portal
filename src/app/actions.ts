"use server";

import { refresh } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { sendDirectMessage } from "@/lib/discord";
import { sendApplicationWebhook, sendReportWebhook } from "@/lib/webhooks";
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

  const row = await queryOne<{ id: number }>(
    `INSERT INTO applications (discord_id, discord_username, discord_avatar, roblox_username, age, timezone, availability, answers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [viewer.uid, viewer.username, viewer.avatar, d.roblox_username, d.age, d.timezone, d.availability, JSON.stringify(answers)],
  );
  const id = Number(row!.id);

  const ok = await sendApplicationWebhook({
    id,
    discordId: viewer.uid,
    discordUsername: viewer.username,
    discordAvatar: viewer.avatar,
    robloxUsername: String(d.roblox_username),
    age: Number(d.age),
    timezone: String(d.timezone),
    availability: String(d.availability),
    answers: answers.filter((a) => a.answer),
  });
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
  if (!(status in APPLICATION_STATUSES)) return { message: "Invalid status." };

  const app = await queryOne<{ discord_id: string }>(
    `UPDATE applications SET status=$1, review_notes=$2, reviewer_id=$3, reviewer_name=$4, reviewed_at=now()
     WHERE id=$5 RETURNING discord_id`,
    [status, notes || null, viewer.uid, viewer.displayName, id],
  );
  if (!app) return { message: "Application not found." };

  let dm = "";
  if (notify && (status === "accepted" || status === "denied")) {
    const msg =
      status === "accepted"
        ? `**Georgia State Patrol — ${appRef(id)}**\nCongratulations! Your cadet application has been **accepted**. A member of command staff will reach out with your next steps.${notes ? `\n\n> ${notes.replace(/\n/g, "\n> ")}` : ""}`
        : `**Georgia State Patrol — ${appRef(id)}**\nThank you for applying. Unfortunately your cadet application has been **denied** at this time.${notes ? `\n\n**Feedback:**\n> ${notes.replace(/\n/g, "\n> ")}` : ""}`;
    const sent = await sendDirectMessage(app.discord_id, msg);
    dm = sent ? " Applicant notified by DM." : " Could not DM the applicant (their DMs may be closed).";
  }
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
