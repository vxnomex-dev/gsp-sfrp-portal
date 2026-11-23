import "server-only";
import { query, queryOne } from "./db";
import { getConfig, rolesFor } from "./config";
import { fetchVoiceChannelOf } from "./discord-bot";

/**
 * /record — voice recordings for Command Staff, Internal Affairs and the Office of the Colonel.
 * The website only queues the request; the always-on recorder (the /recorder folder) joins the channel,
 * records, and posts the audio in the Recordings channel.
 */

type Member = { user: { id: string; username: string; global_name?: string | null }; nick?: string | null; roles: string[] };
type Reply = { type: 4; data: { content: string; flags: number; allowed_mentions: { parse: [] } } };
const reply = (content: string): Reply => ({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
const nameOf = (m: Member) => m.nick || m.user.global_name || m.user.username;

async function allowed(m: Member) {
  const cfg = await getConfig();
  const ids = rolesFor(cfg, "ootc", "highCommand", "command", "hr", "internalAffairs");
  return m.roles.some((r) => ids.includes(r));
}

async function recorderOnline() {
  const row = await queryOne<{ value: string }>(`SELECT value FROM meta WHERE key='recorder_heartbeat'`).catch(() => null);
  return Boolean(row && Date.now() - new Date(row.value).getTime() < 45_000);
}

const ACTIVE = `status IN ('requested','recording','stop_requested')`;

export async function recordCommand(sub: string, member: Member, reason: string | null): Promise<Reply> {
  if (!(await allowed(member))) {
    return reply("Only Command Staff, Internal Affairs, Human Resources and the Office of the Colonel can record voice channels.");
  }
  const cfg = await getConfig();

  if (sub === "status") {
    const rows = await query<{ id: number; channel_id: string; requester_id: string; status: string; started_at: string | null }>(
      `SELECT id, channel_id, requester_id, status, started_at FROM recordings WHERE ${ACTIVE} ORDER BY id`,
    );
    const online = await recorderOnline();
    if (!rows.length) return reply(`Nothing is being recorded right now.${online ? "" : "\n-# The recorder is offline."}`);
    return reply(
      rows
        .map(
          (r) =>
            `**#${r.id}** <#${r.channel_id}> — started by <@${r.requester_id}>` +
            (r.started_at ? ` <t:${Math.floor(new Date(r.started_at).getTime() / 1000)}:R>` : " (starting…)") +
            (r.status === "stop_requested" ? " — stopping" : ""),
        )
        .join("\n"),
    );
  }

  const channelId = await fetchVoiceChannelOf(member.user.id);

  if (sub === "stop") {
    const rec =
      (channelId && (await queryOne<{ id: number }>(`SELECT id FROM recordings WHERE ${ACTIVE} AND channel_id=$1 ORDER BY id DESC`, [channelId]))) ||
      (await queryOne<{ id: number }>(`SELECT id FROM recordings WHERE ${ACTIVE} AND requester_id=$1 ORDER BY id DESC`, [member.user.id]));
    if (!rec) return reply("There's no recording running in your voice channel. Use `/record status` to see what's being recorded.");
    await query(`UPDATE recordings SET status='stop_requested', stopped_by=$1, updated_at=now() WHERE id=$2 AND ${ACTIVE}`, [
      member.user.id,
      rec.id,
    ]);
    return reply(`Stopping recording **#${rec.id}**. The audio will be posted ${cfg.channels.recordings ? `in <#${cfg.channels.recordings}>` : "in your DMs"} once it's processed.`);
  }

  // start
  if (!channelId) return reply("Join the voice channel you want to record first, then run `/record start`.");
  if (!(await recorderOnline())) {
    return reply("The recorder is offline right now, so I can't record. Let the bot owner know.");
  }
  const busy = await queryOne<{ id: number; channel_id: string }>(`SELECT id, channel_id FROM recordings WHERE ${ACTIVE} AND guild_id=$1`, [cfg.guildId]);
  if (busy) {
    return reply(
      busy.channel_id === channelId
        ? `This channel is already being recorded (**#${busy.id}**).`
        : `I'm already recording <#${busy.channel_id}> (**#${busy.id}**). The bot can only be in one voice channel at a time — stop that one first.`,
    );
  }
  const rec = await queryOne<{ id: number }>(
    `INSERT INTO recordings (guild_id, channel_id, requester_id, requester_name, reason) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [cfg.guildId, channelId, member.user.id, nameOf(member), reason?.slice(0, 300) || null],
  );
  return reply(
    `Starting recording **#${rec!.id}** in <#${channelId}>. The bot will join in a few seconds and tell everyone in the channel it's recording.\n` +
      `Use \`/record stop\` when you're done.`,
  );
}

export const RECORD_COMMANDS = [
  {
    name: "record",
    description: "Record a voice channel (Command Staff, Internal Affairs, Office of the Colonel)",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 1,
        name: "start",
        description: "Start recording the voice channel you're in",
        options: [{ type: 3, name: "reason", description: "What it's for, e.g. IA interview, case #12", required: false, max_length: 300 }],
      },
      { type: 1, name: "stop", description: "Stop the recording in your voice channel" },
      { type: 1, name: "status", description: "See what's being recorded" },
    ],
  },
];
