import "server-only";
import { query, queryOne } from "./db";
import { env } from "./env";

export type Nda = {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  roblox: string | null;
  signature: string;
  signed_at: string | Date;
  status: "pending" | "countersigned" | "void";
  rep_id: string | null;
  rep_name: string | null;
  rep_signature: string | null;
  rep_signed_at: string | Date | null;
  void_reason: string | null;
  version: string;
  channel_id: string | null;
  message_id: string | null;
};

export const ndaRef = (id: number) => `NDA-${String(id).padStart(4, "0")}`;

export const getNda = (id: number) =>
  Number.isInteger(id) && id > 0 ? queryOne<Nda>(`SELECT * FROM nda_agreements WHERE id=$1`, [id]) : Promise.resolve(null);

/** The member's current agreement (not voided), if they have one. */
export const currentNdaFor = (userId: string) =>
  queryOne<Nda>(`SELECT * FROM nda_agreements WHERE user_id=$1 AND status <> 'void' ORDER BY id DESC LIMIT 1`, [userId]);

export const ndasFor = (userId: string) => query<Nda>(`SELECT * FROM nda_agreements WHERE user_id=$1 ORDER BY id DESC`, [userId]);

export function listNdas(filter: "pending" | "countersigned" | "void" | "all") {
  return filter === "all"
    ? query<Nda>(`SELECT * FROM nda_agreements ORDER BY id DESC LIMIT 500`)
    : query<Nda>(`SELECT * FROM nda_agreements WHERE status=$1 ORDER BY id DESC LIMIT 500`, [filter]);
}

export const pendingNdaCount = () =>
  queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM nda_agreements WHERE status='pending'`)
    .then((r) => r?.n ?? 0)
    .catch(() => 0);

/* ---------------- Discord: the agreements channel ---------------- */

function ndaMessage(n: Nda, pingRole: string | null = null) {
  const t = (d: string | Date) => Math.floor(new Date(d).getTime() / 1000);
  const status =
    n.status === "countersigned"
      ? `**Status:** Complete — countersigned by **${n.rep_signature}** <t:${t(n.rep_signed_at!)}:R>`
      : n.status === "void"
        ? `**Status:** Void${n.void_reason ? ` — ${n.void_reason}` : ""}`
        : "**Status:** Waiting for a Department Representative to countersign";
  return [
    {
      type: 17,
      components: [
        {
          type: 10,
          content:
            `## Confidentiality Agreement ${n.status === "pending" ? "Signed" : n.status === "countersigned" ? "Complete" : "Void"}\n` +
            (pingRole ? `<@&${pingRole}>\n` : "") +
            `> <@${n.user_id}> signed the **Confidentiality and Employment Agreement**.`,
        },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 10,
          content:
            `**Invitee:** ${n.full_name}\n` +
            `**Discord:** <@${n.user_id}> (@${n.username})\n` +
            (n.roblox ? `**Roblox:** ${n.roblox}\n` : "") +
            `**Signed:** <t:${t(n.signed_at)}:f>\n` +
            status,
        },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: n.status === "pending" ? "Review & countersign" : "View agreement",
              url: `${env.baseUrl}/portal/nda/${n.id}`,
            },
          ],
        },
        { type: 10, content: `-# ${ndaRef(n.id)} · version ${n.version}` },
      ],
    },
  ];
}

/** Posts a newly signed agreement, or updates the post after it's countersigned / voided. */
export async function postNda(id: number) {
  const n = await getNda(id);
  if (!n) return;
  const { getConfig } = await import("./config");
  const { postChannelMessage, editChannelMessage } = await import("./discord-bot");
  const cfg = await getConfig();
  // The Office of the Colonel is pinged when it's first posted (and stays mentioned on later edits, without re-pinging)
  const ootc = cfg.roles.ootc || null;
  const components = ndaMessage(n, ootc);
  if (n.channel_id && n.message_id) {
    await editChannelMessage(n.channel_id, n.message_id, { components });
    return;
  }
  const channel = cfg.channels.ndas;
  if (!channel) return;
  const msg = await postChannelMessage(channel, { components, allowed_mentions: { parse: [], roles: ootc ? [ootc] : [] } });
  await query(`UPDATE nda_agreements SET channel_id=$1, message_id=$2 WHERE id=$3`, [msg.channel_id, msg.id, id]);
}
