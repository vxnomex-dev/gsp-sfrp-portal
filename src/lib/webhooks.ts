import "server-only";
import { env } from "./env";
import { clean, container, divider, quote, text, unix, type Component } from "./components";
import { getConfig } from "./config";
import { postChannelMessage } from "./discord-bot";

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

export function buildReportMessage(r: ReportWebhookInput, roleId: string): Component[] {
  const ref = `HR-${String(r.id).padStart(4, "0")}`;
  return [
    ...(roleId ? [text(`<@&${roleId}>`)] : []),
    container([
      text(`## New Employee Report\n-# ${ref} • Human Resources • <t:${unix()}:f>`),
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
      text(`-# Confidential — Human Resources only. Open the case in the [FHP Portal](${env.baseUrl}/portal/reports/${r.id}).`),
    ]),
  ];
}

/** Posts a new trooper report to the Human Resources channel (Portal → Discord Setup). */
export async function sendReportWebhook(r: ReportWebhookInput): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg.channels.reports) {
    console.warn("[reports] no reports channel chosen in Discord Setup");
    return false;
  }
  try {
    await postChannelMessage(cfg.channels.reports, {
      components: buildReportMessage(r, cfg.roles.reportsPing),
      allowed_mentions: { parse: [], roles: [cfg.roles.reportsPing].filter(Boolean) },
    });
    return true;
  } catch (e) {
    console.error("[reports] bot could not post. Check the bot's permissions in the reports channel.", e);
    return false;
  }
}
