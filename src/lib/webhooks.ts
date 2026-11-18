import "server-only";
import { env } from "./env";
import { avatarUrl } from "./discord";

/**
 * Discord Components V2 messages sent through a normal channel webhook.
 * Docs: https://discord.com/developers/docs/components/reference
 *  - flag IS_COMPONENTS_V2 (1 << 15) is required, and `content`/`embeds` cannot be used
 *  - `?with_components=true` is required for webhooks not owned by a bot application
 *  - only non-interactive components are allowed (so links go in text, not buttons)
 *  - all Text Display content together must stay under 4000 characters
 */

const IS_COMPONENTS_V2 = 1 << 15;
const GOLD = 0xe8b130;
const RED = 0xc8372d;

type Component = Record<string, unknown>;

const text = (content: string): Component => ({ type: 10, content });
const divider = (big = false): Component => ({ type: 14, divider: true, spacing: big ? 2 : 1 });
const section = (content: string, thumbUrl: string): Component => ({
  type: 9,
  components: [text(content)],
  accessory: { type: 11, media: { url: thumbUrl } },
});

/** Stops user input from pinging anyone or breaking formatting. */
function clean(s: string | null | undefined, max = 400) {
  let v = (s ?? "").replace(/@(everyone|here)/gi, "@​$1").replace(/<@[&!]?\d+>/g, "[mention]").trim();
  if (!v) return "_Not provided_";
  if (v.length > max) v = v.slice(0, max - 1).trimEnd() + "…";
  return v;
}
const quote = (s: string | null | undefined, max = 400) =>
  clean(s, max)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

const unix = (d: Date = new Date()) => Math.floor(d.getTime() / 1000);

async function send(url: string, roleId: string, components: Component[]): Promise<boolean> {
  if (!url) {
    console.warn("[webhook] URL not configured; skipping");
    return false;
  }
  const u = new URL(url);
  u.searchParams.set("with_components", "true");
  u.searchParams.set("wait", "true");
  const body = {
    username: "GSP Portal",
    flags: IS_COMPONENTS_V2,
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
    components: [...(roleId ? [text(`<@&${roleId}>`)] : []), ...components],
  };
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[webhook] failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[webhook] error", e);
    return false;
  }
}

export type ApplicationWebhookInput = {
  id: number;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  robloxUsername: string;
  age: number;
  timezone: string;
  availability: string;
  answers: { question: string; answer: string }[];
};

export function buildApplicationMessage(a: ApplicationWebhookInput): Component[] {
  const ref = `APP-${String(a.id).padStart(4, "0")}`;
  return [
    {
      type: 17,
      accent_color: GOLD,
      components: [
        section(
          `## 🚔 New Cadet Application\n-# ${ref} • Georgia State Patrol • <t:${unix()}:f>\n\n` +
            `**Applicant:** <@${a.discordId}> (\`${clean(a.discordUsername, 40)}\`)\n` +
            `**Roblox:** ${clean(a.robloxUsername, 40)}\n` +
            `**Age:** ${a.age}  •  **Timezone:** ${clean(a.timezone, 40)}\n` +
            `**Availability:** ${clean(a.availability, 60)}`,
          avatarUrl(a.discordId, a.discordAvatar),
        ),
        divider(),
        ...a.answers.map((q) => text(`**${q.question}**\n${quote(q.answer, 380)}`)),
        divider(true),
        text(`-# Review, accept or deny this application in the [GSP Portal](${env.baseUrl}/portal/applications/${a.id}).`),
      ],
    },
  ];
}

export function sendApplicationWebhook(a: ApplicationWebhookInput) {
  return send(env.webhooks.applications, env.pingRoles.applications, buildApplicationMessage(a));
}

export type ReportWebhookInput = {
  id: number;
  reporterId: string;
  reporterUsername: string;
  reporterRoblox: string;
  trooperName: string;
  trooperIdentifier: string | null;
  incidentDate: string;
  location: string | null;
  category: string;
  description: string;
  evidence: string | null;
};

export function buildReportMessage(r: ReportWebhookInput): Component[] {
  const ref = `PSB-${String(r.id).padStart(4, "0")}`;
  return [
    {
      type: 17,
      accent_color: RED,
      components: [
        text(`## 🛡️ New Employee Report\n-# ${ref} • Professional Standards Bureau • <t:${unix()}:f>`),
        divider(),
        text(
          `**Trooper reported:** ${clean(r.trooperName, 80)}\n` +
            `**Callsign / badge / Roblox:** ${clean(r.trooperIdentifier, 80)}\n` +
            `**Category:** ${clean(r.category, 60)}\n` +
            `**Date of incident:** ${clean(r.incidentDate, 40)}\n` +
            `**Location:** ${clean(r.location, 80)}`,
        ),
        divider(),
        text(`**What happened**\n${quote(r.description, 1500)}`),
        text(`**Evidence**\n${clean(r.evidence, 600)}`),
        divider(),
        text(
          `**Submitted by:** <@${r.reporterId}> (\`${clean(r.reporterUsername, 40)}\`)\n` +
            `**Reporter Roblox:** ${clean(r.reporterRoblox, 40)}`,
        ),
        divider(true),
        text(`-# Confidential — PSB only. Open the case in the [GSP Portal](${env.baseUrl}/portal/reports/${r.id}).`),
      ],
    },
  ];
}

export function sendReportWebhook(r: ReportWebhookInput) {
  return send(env.webhooks.reports, env.pingRoles.reports, buildReportMessage(r));
}
