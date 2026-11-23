import "server-only";
import { query, queryOne } from "./db";
import { env } from "./env";
import { getConfig } from "./config";
import { deleteChannelMessage, editChannelMessage, postChannelMessage } from "./discord-bot";
import { clean, type Component } from "./components";
import type { Notification } from "./notifications";
import type { PressDoc } from "@/components/PressDocument";

/** Press releases: a letter-style page on the website, and the same page as an image in the press channel. */

export const pressPageUrl = (id: number) => `${env.baseUrl}/press/${id}`;

/** The PNG of the release. `v` changes whenever the release is edited, so Discord doesn't show a stale copy. */
export const pressImageUrl = (n: Pick<Notification, "id" | "created_at"> & { updated_at?: string | Date | null }) =>
  `${env.baseUrl}/press/${n.id}/image?v=${new Date(n.updated_at ?? n.created_at).getTime()}`;

export function pressDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });
}

export const toPressDoc = (n: Notification): PressDoc => ({
  title: n.title,
  body: n.body,
  author: n.author_name,
  date: pressDate(n.created_at),
});

export async function getPressRelease(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return queryOne<Notification & { discord_message_id: string | null; updated_at: string | Date | null }>(
    `SELECT * FROM notifications WHERE id=$1 AND kind='press'`,
    [id],
  );
}

function pressMessage(n: Notification & { updated_at?: string | Date | null }): Component[] {
  return [
    {
      type: 17,
      components: [
        { type: 12, items: [{ media: { url: pressImageUrl(n) }, description: clean(n.title, 200) }] },
        {
          type: 1,
          components: [{ type: 2, style: 5, label: "Read on the website", url: pressPageUrl(n.id) }],
        },
      ],
    },
  ];
}

/** Posts the release to the press channel (or updates the post if it was already sent). */
export async function postPressRelease(id: number) {
  const n = await getPressRelease(id);
  if (!n) return;
  const channel = (await getConfig()).channels.pressReleases;
  if (!channel) return;
  const components = pressMessage(n);
  if (n.discord_message_id) {
    await editChannelMessage(channel, n.discord_message_id, { components });
    return;
  }
  const msg = await postChannelMessage(channel, { components });
  if (msg?.id) await query(`UPDATE notifications SET discord_message_id=$1 WHERE id=$2`, [msg.id, id]);
}

/** Removes the Discord post when a release is deleted on the website. */
export async function deletePressPost(messageId: string | null) {
  if (!messageId) return;
  const channel = (await getConfig()).channels.pressReleases;
  if (!channel) return;
  await deleteChannelMessage(channel, messageId).catch(() => {});
}
