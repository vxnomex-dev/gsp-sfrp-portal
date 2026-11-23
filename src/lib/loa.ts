import "server-only";
import { query, queryOne } from "./db";
import { getConfig } from "./config";
import { buttonRow, clean, container, divider, text, unix, type Component } from "./components";
import { addMemberRole, editChannelMessage, postChannelMessage, removeMemberRole, sendDirectMessageV2 } from "./discord-bot";
import { site } from "./site";

export const LOA_APPROVE = "fhp_loa_approve:";
export const LOA_DENY = "fhp_loa_deny:";
export const LOA_DENY_MODAL = "fhp_loa_denymodal:";
export const LOA_DENY_INPUT = "reason";

export type Loa = {
  id: number;
  user_id: string;
  user_name: string;
  start_date: string | Date;
  end_date: string | Date;
  reason: string;
  status: "pending" | "approved" | "denied" | "ended";
  decided_by_id: string | null;
  decided_by_name: string | null;
  decision_reason: string | null;
  decided_at: string | Date | null;
  ended_at: string | Date | null;
  role_given: boolean;
  channel_id: string | null;
  message_id: string | null;
  created_at: string | Date;
};

/** "2026-11-24" → a time at noon UTC, so <t:…:D> shows the same calendar day across US time zones. */
const dayStamp = (d: string | Date) => {
  const iso = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return unix(new Date(`${iso}T12:00:00Z`));
};
export const isoDay = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));
export const loaDays = (l: Pick<Loa, "start_date" | "end_date">) =>
  Math.round((new Date(isoDay(l.end_date)).getTime() - new Date(isoDay(l.start_date)).getTime()) / 86_400_000) + 1;

const STATUS_LABEL = { pending: "Pending", approved: "Approved", denied: "Denied", ended: "Ended" } as const;

export function loaMessage(l: Loa): Component[] {
  const t = unix(new Date(l.created_at));
  const status: Component[] =
    l.status === "pending"
      ? [buttonRow([
          { id: `${LOA_APPROVE}${l.id}`, label: "Approve", style: 3 },
          { id: `${LOA_DENY}${l.id}`, label: "Deny", style: 4 },
        ])]
      : [
          text(
            `**Status:** ${STATUS_LABEL[l.status]}` +
              (l.decided_by_id ? ` by <@${l.decided_by_id}>` : "") +
              (l.decided_at ? ` on <t:${unix(new Date(l.decided_at))}:D>` : "") +
              (l.decision_reason ? `\n**Reason:** ${clean(l.decision_reason, 400)}` : "") +
              (l.status === "ended" && l.ended_at ? `\n-# Leave ended <t:${unix(new Date(l.ended_at))}:D>.` : ""),
          ),
        ];
  return [
    container([
      text(
        `> <@${l.user_id}> has requested a **Leave of Absence** from <t:${dayStamp(l.start_date)}:D> to <t:${dayStamp(l.end_date)}:D>.`,
      ),
      text(`**Duration:** ${loaDays(l)} day${loaDays(l) === 1 ? "" : "s"}\n**Reason:** ${clean(l.reason, 1000)}`),
      text(`-# ID: ${l.id} | Submitted <t:${t}:f>`),
      divider(),
      ...status,
    ]),
  ];
}

async function updateMessage(l: Loa) {
  if (l.channel_id && l.message_id) {
    await editChannelMessage(l.channel_id, l.message_id, { components: loaMessage(l) }).catch((e) =>
      console.error("[loa] couldn't update the request message", e),
    );
  }
}

export async function createLoa(u: { id: string; name: string }, start: string, end: string, reason: string) {
  const l = (await queryOne<Loa>(
    `INSERT INTO loa_requests (user_id, user_name, start_date, end_date, reason) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [u.id, u.name, start, end, reason],
  ))!;
  const channel = (await getConfig()).channels.loa;
  if (!channel) return { loa: l, posted: false };
  try {
    const msg = await postChannelMessage(channel, { components: loaMessage(l), allowed_mentions: { parse: [], users: [u.id] } });
    await query(`UPDATE loa_requests SET channel_id=$1, message_id=$2 WHERE id=$3`, [msg.channel_id, msg.id, l.id]);
    return { loa: l, posted: true };
  } catch (e) {
    console.error("[loa] couldn't post the request", e);
    return { loa: l, posted: false };
  }
}

export async function getLoa(id: number) {
  return queryOne<Loa>(`SELECT * FROM loa_requests WHERE id=$1`, [id]);
}

export async function listLoas(opts: { userId?: string; limit?: number } = {}) {
  return opts.userId
    ? query<Loa>(`SELECT * FROM loa_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, [opts.userId, opts.limit ?? 20])
    : query<Loa>(
        `SELECT * FROM loa_requests ORDER BY (status='pending') DESC, (status='approved') DESC, created_at DESC LIMIT $1`,
        [opts.limit ?? 100],
      );
}

/** Approve or deny a pending request. Gives / DMs as needed. Returns null if it was already decided. */
export async function decideLoa(id: number, status: "approved" | "denied", by: { id: string; name: string }, reason: string | null) {
  const l = await queryOne<Loa>(
    `UPDATE loa_requests SET status=$2, decided_by_id=$3, decided_by_name=$4, decision_reason=$5, decided_at=now()
     WHERE id=$1 AND status='pending' RETURNING *`,
    [id, status, by.id, by.name, reason],
  );
  if (!l) return null;
  const cfg = await getConfig();
  let roleGiven = false;
  if (status === "approved" && cfg.roles.loa) {
    roleGiven = await addMemberRole(l.user_id, cfg.roles.loa).then(
      () => true,
      () => false,
    );
    if (roleGiven) await query(`UPDATE loa_requests SET role_given=true WHERE id=$1`, [id]);
  }
  await updateMessage(l);
  const dm = await sendDirectMessageV2(l.user_id, [
    container([
      text(
        status === "approved"
          ? `> Your **Leave of Absence** from <t:${dayStamp(l.start_date)}:D> to <t:${dayStamp(l.end_date)}:D> has been **approved**.`
          : `> Your **Leave of Absence** request (ID: ${l.id}) has been **denied**.`,
      ),
      ...(reason ? [text(`**Reason:** ${clean(reason, 400)}`)] : []),
      text(`-# ${clean(site.name, 60)} — ${clean(site.community, 60)}`),
      divider(),
    ]),
  ]);
  return { loa: l, roleGiven, dmSent: dm };
}

/** Ends an approved leave early (or when it runs out) and takes the LOA role back. */
export async function endLoa(id: number, by: { id: string; name: string } | null) {
  const l = await queryOne<Loa>(
    `UPDATE loa_requests SET status='ended', ended_at=now(),
       decided_by_id=COALESCE(decided_by_id,$2), decided_by_name=COALESCE(decided_by_name,$3)
     WHERE id=$1 AND status IN ('approved','pending') RETURNING *`,
    [id, by?.id ?? null, by?.name ?? null],
  );
  if (!l) return null;
  const cfg = await getConfig();
  if (l.role_given && cfg.roles.loa) await removeMemberRole(l.user_id, cfg.roles.loa).catch(() => {});
  await updateMessage(l);
  return l;
}

/** Ends approved leaves whose last day has passed. Cheap; called whenever shift / LOA pages load. */
export async function endExpiredLoas() {
  const expired = await query<{ id: number }>(
    `SELECT id FROM loa_requests WHERE status='approved' AND end_date < (now() AT TIME ZONE 'America/New_York')::date`,
  );
  for (const { id } of expired) await endLoa(id, null).catch(() => {});
}

export function loaDenyModal(id: number) {
  return {
    type: 9,
    data: {
      custom_id: `${LOA_DENY_MODAL}${id}`,
      title: `Deny LOA request #${id}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: LOA_DENY_INPUT,
              label: "Reason (sent to the member)",
              style: 2,
              required: true,
              min_length: 3,
              max_length: 400,
            },
          ],
        },
      ],
    },
  };
}
