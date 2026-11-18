import "server-only";
import { env } from "./env";
import { IS_COMPONENTS_V2, clean, container, divider, quote, text, unix, type Component } from "./components";

/**
 * Posts a Components V2 message through a plain channel webhook.
 *  - `?with_components=true` is required for webhooks not owned by a bot application
 *  - webhooks can't carry clickable buttons — application messages are posted by the bot instead
 *    (see applications-discord.ts); this is also their fallback if the bot can't post.
 */
export async function sendWebhook(
  url: string,
  components: Component[],
  mentions: { roles?: string[]; users?: string[] } = {},
): Promise<boolean> {
  if (!url) {
    console.warn("[webhook] URL not configured; skipping");
    return false;
  }
  const u = new URL(url);
  u.searchParams.set("with_components", "true");
  u.searchParams.set("wait", "true");
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "GSP Portal",
        flags: IS_COMPONENTS_V2,
        allowed_mentions: { parse: [], roles: mentions.roles ?? [], users: mentions.users ?? [] },
        components,
      }),
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
  const roleId = env.pingRoles.reports;
  return [
    ...(roleId ? [text(`<@&${roleId}>`)] : []),
    container([
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
    ]),
  ];
}

export function sendReportWebhook(r: ReportWebhookInput) {
  return sendWebhook(env.webhooks.reports, buildReportMessage(r), { roles: [env.pingRoles.reports].filter(Boolean) });
}
