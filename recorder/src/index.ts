/**
 * Florida Highway Patrol — voice recorder.
 *
 * The website handles /record (it receives every slash command). It writes a row to the `recordings` table;
 * this always-on worker, logged in as the same bot, picks it up, joins the voice channel, records each speaker,
 * and when the recording stops posts the audio (everyone mixed + one file per speaker) in the Recordings channel.
 *
 * Needs: DISCORD_BOT_TOKEN and DATABASE_URL (the same values the website uses).
 */
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  Client,
  GatewayIntentBits,
  GuildPremiumTier,
  PermissionFlagsBits,
  Routes,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import {
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  type AudioReceiveStream,
  type VoiceConnection,
} from "@discordjs/voice";
import { heartbeat, q, recordingsChannelId, setStatus, type RecordingRow } from "./db.js";
import { Track } from "./track.js";
import { mixTracks, partSeconds, splitTrack } from "./encode.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) throw new Error("DISCORD_BOT_TOKEN is not set.");
const MAX_HOURS = Number(process.env.MAX_RECORDING_HOURS || 4);
const EMPTY_STOP_MS = 60_000;
const IS_V2 = 1 << 15;

/** Opus decoder: the fast native one if it installed, otherwise the pure-JavaScript one. */
type Decoder = { decode(packet: Buffer): Buffer };
const makeDecoder: () => Decoder = await (async () => {
  try {
    const { OpusEncoder } = (await import("@discordjs/opus")).default;
    return () => new OpusEncoder(48_000, 2);
  } catch {
    const OpusScript = (await import("opusscript")).default;
    console.log("[recorder] using the JavaScript Opus decoder");
    return () => {
      const o = new OpusScript(48_000, 2, OpusScript.Application.VOIP);
      return { decode: (p: Buffer) => Buffer.from(o.decode(p)) };
    };
  }
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const sessions = new Map<number, Session>(); // by recording id

const fmtLength = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
};
const safeName = (s: string) => s.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "speaker";
const uploadLimit = (g: Guild) =>
  (g.premiumTier === GuildPremiumTier.Tier3 ? 100 : g.premiumTier === GuildPremiumTier.Tier2 ? 50 : 10) * 1024 * 1024;

class Session {
  connection!: VoiceConnection;
  channel!: VoiceBasedChannel;
  readonly tracks = new Map<string, Track>();
  private readonly streams: AudioReceiveStream[] = [];
  private readonly pending = new Set<string>();
  readonly dir: string;
  startedAt = 0;
  emptySince: number | null = null;
  stopping = false;
  private originalNick: string | null = null;

  constructor(
    readonly row: RecordingRow,
    readonly guild: Guild,
  ) {
    this.dir = path.join(os.tmpdir(), `fhp-recording-${row.id}`);
  }

  async start() {
    const ch = await this.guild.channels.fetch(this.row.channel_id).catch(() => null);
    if (!ch?.isVoiceBased()) throw new Error("That voice channel no longer exists.");
    this.channel = ch;
    const me = this.guild.members.me ?? (await this.guild.members.fetchMe());
    const perms = ch.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
      throw new Error(`I don't have permission to join ${ch.name}.`);
    }

    await rm(this.dir, { recursive: true, force: true });
    await mkdir(this.dir, { recursive: true });

    this.connection = joinVoiceChannel({
      channelId: ch.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });
    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    this.startedAt = Date.now();
    await setStatus(this.row.id, "recording", { started_at: new Date(this.startedAt), channel_name: ch.name });

    this.connection.receiver.speaking.on("start", (userId) => void this.listen(userId));
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        void this.stop("I was disconnected from the voice channel.");
      }
    });

    // Let everyone know — the bot's name and the channel chat both say it's recording
    this.originalNick = me.nickname;
    await me.setNickname(`[RECORDING] ${me.nickname ?? client.user!.username}`.slice(0, 32)).catch(() => {});
    await this.notice(
      `## This channel is being recorded\n` +
        `<@${this.row.requester_id}> started a recording of **${ch.name}** for the Florida Highway Patrol` +
        (this.row.reason ? ` (${this.row.reason.slice(0, 200)})` : "") +
        `.\nEverything said here is recorded until the recording is stopped. If you don't agree to being recorded, leave the channel now.`,
    );
  }

  private async notice(content: string) {
    if (!this.channel?.isTextBased()) return;
    await client.rest
      .post(Routes.channelMessages(this.channel.id), {
        body: { flags: IS_V2, allowed_mentions: { parse: [] }, components: [{ type: 17, components: [{ type: 10, content }] }] },
      })
      .catch(() => {});
  }

  /** Starts recording a speaker the first time they talk. */
  private async listen(userId: string) {
    if (this.stopping || this.tracks.has(userId) || this.pending.has(userId)) return;
    this.pending.add(userId);
    try {
      const member: GuildMember | null =
        this.guild.members.cache.get(userId) ?? (await this.guild.members.fetch(userId).catch(() => null));
      if (member?.user.bot) return;
      const name = member?.displayName ?? userId;
      const track = new Track(userId, name, path.join(this.dir, `${userId}.ogg`), this.startedAt);
      this.tracks.set(userId, track);
      const stream = this.connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
      this.streams.push(stream);
      const decoder = makeDecoder();
      stream.on("data", (packet: Buffer) => {
        if (this.stopping) return;
        try {
          track.push(decoder.decode(packet));
        } catch {
          /* corrupt or undecryptable packet — skip it */
        }
      });
      stream.on("error", (e) => console.error(`[rec ${this.row.id}] stream ${name}`, e.message));
    } finally {
      this.pending.delete(userId);
    }
  }

  /** Stops, encodes and uploads. Safe to call more than once. */
  async stop(reason: string) {
    if (this.stopping) return;
    this.stopping = true;
    const endedAt = new Date();
    await setStatus(this.row.id, "processing", { ended_at: endedAt, status_reason: reason }).catch(() => {});
    for (const s of this.streams) s.destroy();
    this.connection?.destroy();
    const me = this.guild.members.me;
    await me?.setNickname(this.originalNick).catch(() => {});
    await this.notice(`## Recording stopped\n${reason}`);

    try {
      await Promise.all([...this.tracks.values()].map((t) => t.finish()));
      const spoken = [...this.tracks.values()].filter((t) => t.bytesIn > 0);
      const length = (endedAt.getTime() - this.startedAt) / 1000;
      const result = await upload(this, spoken, length, reason);
      await setStatus(this.row.id, "done", {
        message_url: result,
        participants: JSON.stringify(spoken.map((t) => ({ id: t.userId, name: t.name }))),
      });
    } catch (e) {
      console.error(`[rec ${this.row.id}] failed`, e);
      await setStatus(this.row.id, "failed", { status_reason: `Couldn't save the recording: ${(e as Error).message.slice(0, 300)}` });
      await dm(this.row.requester_id, `Recording #${this.row.id} of **${this.channel?.name}** couldn't be saved: ${(e as Error).message.slice(0, 300)}`);
    } finally {
      sessions.delete(this.row.id);
      await rm(this.dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function dm(userId: string, content: string) {
  const u = await client.users.fetch(userId).catch(() => null);
  await u?.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
}

/** Posts the summary and the audio files. Returns a link to the summary. */
async function upload(s: Session, tracks: Track[], length: number, reason: string) {
  const { row, guild } = s;
  const outDir = path.join(s.dir, "out");
  await mkdir(outDir, { recursive: true });
  const seconds = partSeconds(uploadLimit(guild));

  const mixed = await mixTracks(tracks.map((t) => t.file), outDir, seconds);
  const perSpeaker: { label: string; files: string[] }[] = [];
  for (const t of tracks) {
    perSpeaker.push({ label: t.name, files: await splitTrack(t.file, outDir, safeName(t.name) + "_" + t.userId.slice(-4), seconds) });
  }

  // Where it goes: the Recordings channel, or the requester's DMs if none is set
  const channelId = (await recordingsChannelId()) ?? (await (await client.users.fetch(row.requester_id)).createDM()).id;
  const started = Math.floor(s.startedAt / 1000);
  const speakers = tracks.length ? tracks.map((t) => `<@${t.userId}>`).join(", ") : "_Nobody spoke_";
  const header = (await client.rest.post(Routes.channelMessages(channelId), {
    body: {
      flags: IS_V2,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content:
                `## Voice Recording #${row.id}\n` +
                `**Channel:** ${s.channel ? `<#${s.channel.id}> (${s.channel.name})` : row.channel_id}\n` +
                `**Requested by:** <@${row.requester_id}>\n` +
                (row.reason ? `**Reason:** ${row.reason.slice(0, 300)}\n` : "") +
                `**Started:** <t:${started}:f>\n` +
                `**Length:** ${fmtLength(length)}\n` +
                `**Speakers:** ${speakers}\n` +
                `**Ended:** ${reason}`,
            },
            { type: 14, divider: true, spacing: 1 },
            {
              type: 10,
              content: tracks.length
                ? `-# **Everyone** is the whole conversation mixed together. Each speaker also has their own file. Long recordings are split into parts.`
                : `-# No audio was captured.`,
            },
          ],
        },
      ],
    },
  })) as { id: string; channel_id: string };

  const send = async (file: string, caption: string) => {
    await client.rest.post(Routes.channelMessages(channelId), {
      body: { content: caption, allowed_mentions: { parse: [] } },
      files: [{ name: `recording-${row.id}-${path.basename(file)}`, data: await import("node:fs/promises").then((f) => f.readFile(file)) }],
    });
  };
  for (const [i, f] of mixed.entries()) await send(f, `-# Recording #${row.id} · Everyone · part ${i + 1} of ${mixed.length}`);
  for (const sp of perSpeaker) {
    for (const [i, f] of sp.files.entries()) await send(f, `-# Recording #${row.id} · ${sp.label} · part ${i + 1} of ${sp.files.length}`);
  }

  const url = `https://discord.com/channels/${(await recordingsChannelId()) ? guild.id : "@me"}/${header.channel_id}/${header.id}`;
  if (await recordingsChannelId()) await dm(row.requester_id, `Recording #${row.id} of **${s.channel?.name}** is ready: ${url}`);
  return url;
}

/* ---------------- Job loop ---------------- */

async function startRecording(row: RecordingRow) {
  const guild = client.guilds.cache.get(row.guild_id) ?? (await client.guilds.fetch(row.guild_id).catch(() => null));
  if (!guild) return setStatus(row.id, "failed", { status_reason: "I'm not in that server." });
  const busy = [...sessions.values()].find((x) => x.guild.id === guild.id);
  if (busy) {
    return setStatus(row.id, "failed", { status_reason: `Already recording ${busy.channel?.name ?? "another channel"}. Stop that first.` });
  }
  const session = new Session(row, guild);
  sessions.set(row.id, session);
  try {
    await session.start();
    console.log(`[rec ${row.id}] recording ${session.channel.name}`);
  } catch (e) {
    sessions.delete(row.id);
    session.connection?.destroy();
    await rm(session.dir, { recursive: true, force: true }).catch(() => {});
    await setStatus(row.id, "failed", { status_reason: (e as Error).message.slice(0, 300) });
    await dm(row.requester_id, `I couldn't start recording: ${(e as Error).message.slice(0, 300)}`);
  }
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const rows = await q<RecordingRow>(`SELECT * FROM recordings WHERE status IN ('requested','stop_requested') ORDER BY id`);
    for (const row of rows) {
      if (row.status === "requested" && !sessions.has(row.id)) await startRecording(row);
      if (row.status === "stop_requested") {
        const s = sessions.get(row.id);
        if (s) void s.stop(row.stopped_by ? `Stopped by <@${row.stopped_by}>.` : "Stopped.");
        else await setStatus(row.id, "failed", { status_reason: "This recording was no longer running." });
      }
    }
    // Stop by itself when everyone has left, or at the time limit
    for (const s of sessions.values()) {
      if (s.stopping || !s.startedAt) continue;
      const ch = s.guild.channels.cache.get(s.row.channel_id);
      const people = ch?.isVoiceBased() ? ch.members.filter((m) => !m.user.bot).size : 0;
      if (people === 0) {
        s.emptySince ??= Date.now();
        if (Date.now() - s.emptySince > EMPTY_STOP_MS) void s.stop("Everyone left the channel.");
      } else s.emptySince = null;
      if (Date.now() - s.startedAt > MAX_HOURS * 3_600_000) void s.stop(`Reached the ${MAX_HOURS}-hour limit.`);
    }
  } catch (e) {
    console.error("[recorder] tick failed", e);
  } finally {
    ticking = false;
  }
}

client.once("clientReady", async () => {
  console.log(`[recorder] logged in as ${client.user!.tag}`);
  // Anything left over from before a restart can't be resumed
  await q(
    `UPDATE recordings SET status='failed', status_reason='The recorder restarted before this recording finished.', updated_at=now()
     WHERE status IN ('recording','stop_requested','processing')`,
  );
  await q(
    `UPDATE recordings SET status='failed', status_reason='The recorder was offline.', updated_at=now()
     WHERE status='requested' AND created_at < now() - interval '2 minutes'`,
  );
  await heartbeat();
  setInterval(() => void heartbeat().catch(() => {}), 10_000);
  setInterval(() => void tick(), 2_000);
});

async function shutdown() {
  console.log("[recorder] shutting down — saving active recordings");
  await Promise.all([...sessions.values()].map((s) => s.stop("The recorder was restarted.")));
  await client.destroy();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
process.on("SIGHUP", () => void shutdown()); // Terminal window closed

await client.login(TOKEN);
