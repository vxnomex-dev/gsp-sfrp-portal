import "server-only";
import { env } from "./env";
import { site } from "./site";
import { query, queryOne } from "./db";
import { avatarUrl } from "./discord";
import { appRef } from "./forms";
import {
  GOLD,
  GREEN,
  RED,
  buttonRow,
  clean,
  container,
  divider,
  quote,
  section,
  text,
  unix,
  type Component,
} from "./components";
import {
  editChannelMessage,
  getApplicationsChannelId,
  postChannelMessage,
  sendDirectMessageV2,
  type V2Message,
} from "./discord-bot";
import { sendWebhook } from "./webhooks";
import type { Application } from "./data";

/* ------------------------------------------------------------------ */
/* The staff message in the applications channel                       */
/* ------------------------------------------------------------------ */

export const ACCEPT_PREFIX = "gsp_app_accept:";
export const DENY_PREFIX = "gsp_app_deny:";
/** The "reason for denial" pop-up that opens when Deny is clicked. */
export const DENY_MODAL_PREFIX = "gsp_app_denymodal:";
export const DENY_REASON_INPUT = "reason";

export function denyReasonModal(id: number) {
  return {
    type: 9, // MODAL
    data: {
      custom_id: `${DENY_MODAL_PREFIX}${id}`,
      title: `Deny ${appRef(id)}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4, // text input
              custom_id: DENY_REASON_INPUT,
              label: "Reason for denial (sent to the applicant)",
              style: 2, // paragraph
              required: true,
              min_length: 5,
              max_length: 500,
              placeholder: "e.g. Answers were too short and didn't show an understanding of the role.",
            },
          ],
        },
      ],
    },
  };
}

type AppForMessage = Pick<
  Application,
  | "id"
  | "discord_id"
  | "discord_username"
  | "discord_avatar"
  | "roblox_username"
  | "age"
  | "timezone"
  | "availability"
  | "answers"
  | "status"
  | "reviewer_id"
  | "reviewer_name"
  | "reviewed_at"
  | "created_at"
  | "denial_reason"
>;

export function buildApplicationMessage(a: AppForMessage, { withButtons }: { withButtons: boolean }): V2Message {
  const decided = a.status === "accepted" || a.status === "denied";
  const accent = a.status === "accepted" ? GREEN : a.status === "denied" ? RED : GOLD;
  const roleId = env.pingRoles.applications;
  const submitted = unix(a.created_at ? new Date(a.created_at) : new Date());

  let footer: Component[];
  if (decided) {
    const by = a.reviewer_id && /^\d+$/.test(a.reviewer_id) ? `<@${a.reviewer_id}>` : clean(a.reviewer_name, 40);
    const when = a.reviewed_at ? ` • <t:${unix(new Date(a.reviewed_at))}:R>` : "";
    footer = [
      text(
        a.status === "accepted"
          ? `### ✅ Accepted by ${by}${when}\n-# The applicant has been sent their next steps by DM.`
          : `### ❌ Denied by ${by}${when}\n**Reason:**\n${quote(a.denial_reason, 500)}\n-# The applicant has been notified by DM.`,
      ),
    ];
  } else if (withButtons) {
    footer = [
      buttonRow([
        { id: `${ACCEPT_PREFIX}${a.id}`, label: "Accept", style: 3, emoji: "✅" },
        { id: `${DENY_PREFIX}${a.id}`, label: "Deny", style: 4, emoji: "✖️" },
      ]),
    ];
  } else {
    footer = [];
  }

  const answers = a.answers.filter((q) => q.answer);

  return {
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [], users: [a.discord_id] },
    components: [
      text(`${roleId ? `<@&${roleId}> ` : ""}<@${a.discord_id}>`),
      container(accent, [
        section(
          `## 🚔 New Cadet Application\n-# ${appRef(a.id)} • Georgia State Patrol • <t:${submitted}:f>\n\n` +
            `**Applicant:** <@${a.discord_id}> (\`${clean(a.discord_username, 40)}\`)\n` +
            `**Roblox:** ${clean(a.roblox_username, 40)}\n` +
            `**Age:** ${a.age}  •  **Timezone:** ${clean(a.timezone, 40)}\n` +
            `**Availability:** ${clean(a.availability, 60)}`,
          avatarUrl(a.discord_id, a.discord_avatar),
        ),
        divider(),
        ...answers.map((q) => text(`**${q.question}**\n${quote(q.answer, 380)}`)),
        divider(true),
        text(`-# Full application in the [GSP Portal](${env.baseUrl}/portal/applications/${a.id}).`),
        ...footer,
      ]),
    ],
  };
}

/**
 * Posts a new application to Discord. Uses the bot (so the Accept/Deny buttons work);
 * if the bot can't post there, falls back to the webhook without buttons so nothing is lost.
 */
export async function announceApplication(a: AppForMessage): Promise<boolean> {
  const channelId = await getApplicationsChannelId();
  if (channelId && env.discord.botToken) {
    try {
      const msg = await postChannelMessage(channelId, buildApplicationMessage(a, { withButtons: true }));
      await query(`UPDATE applications SET discord_channel_id=$1, discord_message_id=$2 WHERE id=$3`, [
        msg.channel_id,
        msg.id,
        a.id,
      ]);
      return true;
    } catch (e) {
      console.error("[applications] bot could not post — falling back to webhook. Check the bot's channel permissions.", e);
    }
  }
  const fallback = buildApplicationMessage(a, { withButtons: false });
  return sendWebhook(env.webhooks.applications, fallback.components, {
    roles: fallback.allowed_mentions?.roles,
    users: fallback.allowed_mentions?.users,
  });
}

/* ------------------------------------------------------------------ */
/* Direct messages to the applicant                                    */
/* ------------------------------------------------------------------ */

export function acceptedDM(a: { id: number; discord_id: string }): Component[] {
  return [
    container(GREEN, [
      text(
        `## ✅ Cadet Application Accepted\n` +
          `Congratulations <@${a.discord_id}>! Your application to the **Georgia State Patrol** has been **accepted**.\n-# ${appRef(a.id)}`,
      ),
      divider(),
      text(
        `### Your next steps\n` +
          `**1.** Head over to <#${site.cadetDashboardChannelId}> (Cadet Dashboard) and read it over carefully.\n` +
          `**2.** Wait for a training to commence — keep an eye out for the announcement.\n` +
          `**3.** When a training commences, attend it. Your **Field Training Instructor** will issue your callsign and you'll continue from there.`,
      ),
      divider(true),
      text(`-# Welcome to the Patrol. • Georgia State Patrol — ${site.community}`),
    ]),
  ];
}

export function deniedDM(a: { id: number; discord_id: string; denial_reason: string | null }): Component[] {
  return [
    container(RED, [
      text(
        `## Cadet Application Denied\n` +
          `Thank you for your interest in the **Georgia State Patrol**. Unfortunately, your application did not pass this time.`,
      ),
      divider(),
      ...(a.denial_reason ? [text(`**Reason:**\n${quote(a.denial_reason, 500)}`)] : []),
      text(`You're welcome to apply again in the future.`),
      divider(true),
      text(`-# ${appRef(a.id)} • Georgia State Patrol — ${site.community}`),
    ]),
  ];
}

/* ------------------------------------------------------------------ */
/* One place that records a decision — used by the buttons AND portal  */
/* ------------------------------------------------------------------ */

export type DecisionResult =
  | { ok: true; app: Application; dmSent: boolean | null }
  | { ok: false; reason: "not_found" | "already_decided"; app?: Application };

export async function recordDecision(opts: {
  id: number;
  status: "pending" | "review" | "accepted" | "denied";
  reviewerId: string;
  reviewerName: string;
  notes?: string | null;
  /** Required when denying — stored and sent to the applicant. */
  reason?: string | null;
  /** Buttons can only decide applications that are still open; the portal may change a decision. */
  onlyIfOpen: boolean;
  notify: boolean;
  /** Skip editing the Discord message (the button handler edits it through the interaction instead). */
  skipMessageEdit?: boolean;
}): Promise<DecisionResult> {
  const row = await queryOne<Application>(
    `UPDATE applications
       SET status=$1, reviewer_id=$2, reviewer_name=$3,
           review_notes = CASE WHEN $4::text IS NULL THEN review_notes ELSE $4::text END,
           denial_reason = CASE WHEN $1 = 'denied' THEN $7::text ELSE NULL END,
           reviewed_at=now()
     WHERE id=$5 AND (NOT $6 OR status IN ('pending','review'))
     RETURNING *`,
    [opts.status, opts.reviewerId, opts.reviewerName, opts.notes ?? null, opts.id, opts.onlyIfOpen, opts.reason?.trim() || null],
  );
  if (!row) {
    const existing = await queryOne<Application>(`SELECT * FROM applications WHERE id=$1`, [opts.id]);
    return existing ? { ok: false, reason: "already_decided", app: parse(existing) } : { ok: false, reason: "not_found" };
  }
  const app = parse(row);

  let dmSent: boolean | null = null;
  if (opts.notify && (app.status === "accepted" || app.status === "denied")) {
    dmSent = await sendDirectMessageV2(app.discord_id, app.status === "accepted" ? acceptedDM(app) : deniedDM(app));
  }

  if (!opts.skipMessageEdit) await refreshApplicationMessage(app);
  return { ok: true, app, dmSent };
}

/** Re-renders the staff message in Discord to match the database (e.g. after a portal decision). */
export async function refreshApplicationMessage(app: Application) {
  if (!app.discord_channel_id || !app.discord_message_id) return;
  try {
    await editChannelMessage(app.discord_channel_id, app.discord_message_id, {
      components: buildApplicationMessage(app, { withButtons: true }).components,
    });
  } catch (e) {
    console.error("[applications] could not update Discord message", e);
  }
}

function parse(a: Application): Application {
  return { ...a, answers: typeof a.answers === "string" ? JSON.parse(a.answers) : a.answers };
}
