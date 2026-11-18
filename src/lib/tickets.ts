import "server-only";
import { env } from "./env";
import { query, queryOne } from "./db";
import { site } from "./site";
import { IS_COMPONENTS_V2, clean, container, divider, fileComponent, text, unix, type Component } from "./components";
import {
  createGuildTextChannel,
  deleteChannel,
  editInteractionResponse,
  fetchAllMessages,
  postChannelMessage,
  postChannelMessageWithFile,
  sendDirectMessageV2,
  type FileUpload,
  type Overwrite,
} from "./discord-bot";
import { buildTranscript } from "./transcripts";

/** #ticket-transcripts — every closed ticket's transcript is posted here. */
export const TRANSCRIPT_CHANNEL_ID = "1572686004882636990";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const ROLE = {
  officeOfTheColonel: "1558194099327074422",
  highCommand: "1558194099327074418",
  command: "1558194099297853566",
  supervisor: "1558194099268358282",
};

/**
 * Roles that can see, claim and close ANY ticket (all three types), on top of each panel's own team.
 * They are not pinged on tickets outside their own team.
 */
export const CLOSE_ANY_ROLES = [ROLE.officeOfTheColonel, ROLE.highCommand, ROLE.command];

export type TicketKind = "general" | "divisional" | "command";

export const TICKET_TYPES: Record<
  TicketKind,
  {
    label: string;
    prefix: string;
    categoryId: string;
    /** Roles that can see the channel and use /claim, /close, /close-request. */
    supportRoles: string[];
    /** Roles pinged when the ticket opens (the opener is always pinged too). */
    pingRoles: string[];
    summary: string;
    placeholder: string;
    emoji: string;
  }
> = {
  general: {
    label: "General Support",
    prefix: "general",
    categoryId: "1558194104939061342",
    supportRoles: [ROLE.supervisor],
    pingRoles: [ROLE.supervisor],
    summary: "General concerns, questions and inquiries.",
    placeholder: "How can General Support help?",
    emoji: "💬",
  },
  divisional: {
    label: "Divisional Support",
    prefix: "divisional",
    categoryId: "1558194104939061346",
    supportRoles: [ROLE.highCommand, ROLE.command],
    pingRoles: [ROLE.highCommand, ROLE.command],
    summary:
      "Specialty unit applications, division transfers, division questions, training requests, qualification requests, operational concerns, unit activity requests and other matters related to specialized divisions.",
    placeholder: "How can Divisional Support help?",
    emoji: "🚓",
  },
  command: {
    label: "Command Support",
    prefix: "command",
    categoryId: "1558194104939061341",
    supportRoles: [ROLE.highCommand, ROLE.command],
    pingRoles: [ROLE.highCommand, ROLE.command],
    summary: "Leadership concerns, administrative matters and issues requiring review by the Office of the Colonel.",
    placeholder: "How can Command Support help?",
    emoji: "⭐",
  },
};

export const IDS = {
  panelSelect: "gsp_ticket_open",
  modalPrefix: "gsp_ticket_modal:",
  modalInput: "inquiry",
  claim: "gsp_ticket_claim",
  close: "gsp_ticket_close",
  closeConfirm: "gsp_ticket_close_confirm",
  keepOpen: "gsp_ticket_keep_open",
};

// Discord permission bits
const P = {
  VIEW: 2 ** 10,
  SEND: 2 ** 11,
  EMBED: 2 ** 14,
  ATTACH: 2 ** 15,
  HISTORY: 2 ** 16,
  MANAGE_CHANNELS: 2 ** 4,
};
const TALK = String(P.VIEW + P.SEND + P.EMBED + P.ATTACH + P.HISTORY);
const BOT = String(P.VIEW + P.SEND + P.EMBED + P.ATTACH + P.HISTORY + P.MANAGE_CHANNELS);

/* ------------------------------------------------------------------ */
/* Types & small helpers                                               */
/* ------------------------------------------------------------------ */

export type Member = {
  roles: string[];
  nick?: string | null;
  user: { id: string; username: string; global_name?: string | null };
};

export type Ticket = {
  id: number;
  kind: TicketKind;
  channel_id: string | null;
  opener_id: string;
  opener_name: string;
  inquiry: string;
  status: "open" | "closed";
  claimed_by_id: string | null;
  claimed_by_name: string | null;
  created_at: string | Date;
};

export const displayName = (m: Member) => m.nick || m.user.global_name || m.user.username;
const isSupport = (m: Member, kind: TicketKind) => m.roles.some((r) => TICKET_TYPES[kind].supportRoles.includes(r));
/** Can claim / close / close-request: the panel's team, plus Office of the Colonel / High Command / Command on any ticket. */
const canClose = (m: Member, kind: TicketKind) => isSupport(m, kind) || m.roles.some((r) => CLOSE_ANY_ROLES.includes(r));

function snowflakeDate(id: string) {
  return new Date(Number(BigInt(id) / BigInt(4194304)) + 1420070400000);
}

function channelName(prefix: string, username: string) {
  const safe = username.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 80) || "user";
  return `${prefix}-${safe}`;
}

/** Message body for a Components V2 interaction reply. */
const v2 = (components: Component[], extra: { allowed_mentions?: Record<string, unknown> } = {}) => ({
  flags: IS_COMPONENTS_V2,
  components,
  allowed_mentions: { parse: [] },
  ...extra,
});

/** Interaction reply: a plain private message only the clicker can see. */
export const privateReply = (content: string) => ({
  type: 4,
  data: { content, flags: 64, allowed_mentions: { parse: [] } },
});

export const getTicketByChannel = (channelId: string) =>
  queryOne<Ticket>(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [channelId]);

/* ------------------------------------------------------------------ */
/* The support panel                                                   */
/* ------------------------------------------------------------------ */

export function buildPanel(): Component[] {
  return [
    container([
      text(`## Department Assistance`),
      text(
        `> If you need help with anything related to the department, do not hesitate to contact a supervisor or member of command staff. ` +
          `Be sure to clearly explain your issue or request so it can be handled efficiently. We are committed to supporting all members and ensuring a professional environment.`,
      ),
      divider(),
      text(`**General Support** — ${TICKET_TYPES.general.summary}`),
      divider(),
      text(`**Divisional Support** — ${TICKET_TYPES.divisional.summary}`),
      divider(),
      text(`**Command Support** — ${TICKET_TYPES.command.summary}`),
      divider(true),
      {
        type: 1,
        components: [
          {
            type: 3, // string select
            custom_id: IDS.panelSelect,
            placeholder: "Select a support type to open a ticket",
            options: (Object.keys(TICKET_TYPES) as TicketKind[]).map((k) => ({
              label: TICKET_TYPES[k].label,
              value: k,
              emoji: { name: TICKET_TYPES[k].emoji },
            })),
          },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: "Report a Trooper", url: `${env.baseUrl}/report` },
          { type: 2, style: 5, label: "Cadet Application", url: `${env.baseUrl}/apply` },
        ],
      },
    ]),
  ];
}

/** The "What's up?" pop-up shown after picking a support type. */
export function inquiryModal(kind: TicketKind) {
  return {
    type: 9,
    data: {
      custom_id: `${IDS.modalPrefix}${kind}`,
      title: "What's up?",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: IDS.modalInput,
              label: "What's up?",
              style: 2,
              required: true,
              min_length: 5,
              max_length: 1000,
              placeholder: TICKET_TYPES[kind].placeholder,
            },
          ],
        },
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Opening a ticket                                                    */
/* ------------------------------------------------------------------ */

function welcomeMessage(t: { id: number; kind: TicketKind; inquiry: string }, member: Member): Component[] {
  const cfg = TICKET_TYPES[t.kind];
  const u = member.user;
  const created = unix(snowflakeDate(u.id));
  return [
    text([...cfg.pingRoles.map((r) => `<@&${r}>`), `<@${u.id}>`].join(" ")),
    container([
      text(`## Welcome to ${cfg.label}, <@${u.id}>.`),
      text(
        `> Thank you for contacting ${cfg.label}. A member of our team will review your ticket and assist you as soon as possible. ` +
          `Please refrain from pinging any of our team members — we will be with you shortly. Make sure to describe in detail how we can assist you!`,
      ),
      divider(),
      text(
        `### Discord Information\n` +
          `> **Discord Username:** \`${clean(u.username, 40)}\`\n` +
          `> **Discord ID:** \`${u.id}\`\n` +
          `> **Created:** <t:${created}:F> | <t:${created}:R>`,
      ),
      divider(),
      text(`### What's up?\n\`\`\`\n${clean(t.inquiry, 1000).replace(/```/g, "ˋˋˋ")}\n\`\`\``),
      divider(),
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Claim", custom_id: IDS.claim },
          { type: 2, style: 4, label: "Close", custom_id: IDS.close },
        ],
      },
      text(`-# Ticket #${t.id} • Staff: \`/claim\` • \`/close\` • \`/close-request\``),
    ]),
  ];
}

/**
 * Runs after the "What's up?" form is submitted (Discord has already been told to wait).
 * Creates the private channel, posts the welcome message and tells the user where to go.
 */
export async function openTicket(interactionToken: string, kind: TicketKind, member: Member, inquiry: string) {
  const cfg = TICKET_TYPES[kind];
  const u = member.user;

  const existing = await queryOne<{ channel_id: string }>(
    `SELECT channel_id FROM tickets WHERE opener_id=$1 AND kind=$2 AND status='open' AND channel_id IS NOT NULL LIMIT 1`,
    [u.id, kind],
  );
  if (existing) {
    await editInteractionResponse(interactionToken, {
      content: `You already have an open ${cfg.label} ticket: <#${existing.channel_id}>`,
    });
    return;
  }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO tickets (kind, opener_id, opener_name, inquiry) VALUES ($1,$2,$3,$4) RETURNING id`,
    [kind, u.id, u.username, inquiry],
  );
  const id = Number(row!.id);

  try {
    const overwrites: Overwrite[] = [
      { id: env.discord.guildId, type: 0, deny: String(P.VIEW) }, // @everyone can't see it
      { id: u.id, type: 1, allow: TALK }, // the person who opened it
      { id: env.discord.clientId, type: 1, allow: BOT }, // the bot itself
      // this panel's support team + the roles that can close any ticket
      ...[...new Set([...cfg.supportRoles, ...CLOSE_ANY_ROLES])].map((r) => ({ id: r, type: 0 as const, allow: TALK })),
    ];
    const channel = await createGuildTextChannel({
      name: channelName(cfg.prefix, u.username),
      parentId: cfg.categoryId,
      overwrites,
      topic: `${cfg.label} ticket #${id} — opened by ${u.username} (${u.id})`,
    });
    await query(`UPDATE tickets SET channel_id=$1 WHERE id=$2`, [channel.id, id]);

    await postChannelMessage(channel.id, {
      components: welcomeMessage({ id, kind, inquiry }, member),
      allowed_mentions: { parse: [], roles: cfg.pingRoles, users: [u.id] },
    });

    await editInteractionResponse(interactionToken, { content: `${cfg.label} ticket opened: <#${channel.id}>` });
  } catch (e) {
    console.error("[tickets] could not open ticket", e);
    await query(`DELETE FROM tickets WHERE id=$1`, [id]);
    await editInteractionResponse(interactionToken, {
      content:
        "Sorry — I couldn't open your ticket. Please let a supervisor know (the bot may be missing Manage Channels / Manage Roles permissions).",
    }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Claim / close / close request                                        */
/* ------------------------------------------------------------------ */

type Reply = Record<string, unknown>;

export async function claimTicket(channelId: string, member: Member): Promise<Reply> {
  const t = await getTicketByChannel(channelId);
  if (!t) return privateReply("This command only works inside an open support ticket.");
  if (!canClose(member, t.kind)) return privateReply(`Only the ${TICKET_TYPES[t.kind].label} team can claim this ticket.`);
  if (t.claimed_by_id) {
    return privateReply(
      t.claimed_by_id === member.user.id ? "You've already claimed this ticket." : `This ticket was already claimed by <@${t.claimed_by_id}>.`,
    );
  }
  await query(`UPDATE tickets SET claimed_by_id=$1, claimed_by_name=$2 WHERE id=$3`, [member.user.id, displayName(member), t.id]);
  return {
    type: 4,
    data: v2(
      [
        container([
          text(`### ✅ Ticket Claimed\n<@${member.user.id}> has claimed this ticket and will be assisting you, <@${t.opener_id}>.`),
        ], false),
      ],
      { allowed_mentions: { parse: [], users: [t.opener_id] } },
    ),
  };
}

/** Responds right away, then closes the channel a few seconds later (see finishClose). */
export async function startClose(channelId: string, member: Member, reason: string | null, { byOpener = false } = {}) {
  const t = await getTicketByChannel(channelId);
  if (!t) return { reply: privateReply("This command only works inside an open support ticket."), ticket: null };
  const allowed = canClose(member, t.kind) || (byOpener && member.user.id === t.opener_id);
  if (!allowed) {
    return {
      reply: privateReply(`Only the ${TICKET_TYPES[t.kind].label} team can close this ticket. Ask them to use \`/close-request\`.`),
      ticket: null,
    };
  }
  const why = reason?.trim() || "No reason provided.";
  return {
    ticket: t,
    reason: why,
    reply: {
      type: 4,
      data: v2([
        container([
          text(
            `### 🔒 Closing Ticket\nThis ticket was closed by <@${member.user.id}> and will be deleted in **5 seconds**.\n**Reason:** ${clean(why, 300)}`,
          ),
        ], false),
      ]),
    },
  };
}

export async function finishClose(t: Ticket, member: Member, reason: string) {
  const started = Date.now();
  await query(
    `UPDATE tickets SET status='closed', closed_by_id=$1, closed_by_name=$2, close_reason=$3, closed_at=now() WHERE id=$4`,
    [member.user.id, displayName(member), reason, t.id],
  );
  const cfg = TICKET_TYPES[t.kind];
  const chName = channelName(cfg.prefix, t.opener_name);

  // Give Discord a moment so the "Closing Ticket" notice is included, then build the transcript.
  await new Promise((r) => setTimeout(r, 1500));
  let transcript: FileUpload | undefined;
  let messageCount = 0;
  if (t.channel_id) {
    try {
      const messages = await fetchAllMessages(t.channel_id);
      messageCount = messages.length;
      const html = buildTranscript(
        {
          ticketId: t.id,
          kindLabel: cfg.label,
          channelName: chName,
          openerId: t.opener_id,
          openerName: t.opener_name,
          inquiry: t.inquiry,
          claimedBy: t.claimed_by_name,
          closedBy: displayName(member),
          reason,
          openedAt: new Date(t.created_at),
          closedAt: new Date(),
        },
        messages,
      );
      transcript = { name: `transcript-${chName}-${t.id}.html`, data: html, contentType: "text/html" };
    } catch (e) {
      console.error("[tickets] transcript failed", e);
    }
  }

  // Staff log in the transcripts channel
  try {
    const details =
      `> **Ticket:** #${t.id} — ${cfg.label}\n` +
      `> **Opened by:** <@${t.opener_id}> (\`${clean(t.opener_name, 40)}\`)\n` +
      `> **Claimed by:** ${t.claimed_by_id ? `<@${t.claimed_by_id}>` : "Unclaimed"}\n` +
      `> **Closed by:** <@${member.user.id}>\n` +
      `> **Reason:** ${clean(reason, 300)}\n` +
      `> **Opened:** <t:${unix(new Date(t.created_at))}:f> • **Closed:** <t:${unix()}:f>\n` +
      `> **Messages:** ${messageCount}`;
    const log = [container([text(`### 📁 Ticket Closed — ${cfg.label} #${t.id}`), text(details), ...(transcript ? [fileComponent(transcript.name)] : [text("-# Transcript unavailable.")])], false)];
    if (transcript) await postChannelMessageWithFile(TRANSCRIPT_CHANNEL_ID, { components: log }, transcript);
    else await postChannelMessage(TRANSCRIPT_CHANNEL_ID, { components: log });
  } catch (e) {
    console.error("[tickets] could not post to the transcripts channel", e);
  }

  // DM the member who opened it
  await sendDirectMessageV2(
    t.opener_id,
    [
      container([
        text(`## Ticket Closed\nYour **${cfg.label}** ticket has been closed.`),
        divider(),
        text(
          `> **Ticket:** #${t.id}\n` +
            `> **Closed by:** ${clean(displayName(member), 40)}\n` +
            `> **Reason:** ${clean(reason, 300)}`,
        ),
        ...(transcript ? [divider(), text(`**Transcript** — open the file below in your browser to read the full conversation.`), fileComponent(transcript.name)] : []),
        divider(true),
        text(`-# Need more help? Open a new ticket any time. • Georgia State Patrol — ${site.community}`),
      ]),
    ],
    transcript,
  );

  // Delete the channel (at least 5 seconds after the closing notice)
  const wait = 5000 - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (t.channel_id) await deleteChannel(t.channel_id).catch((e) => console.error("[tickets] delete failed", e));
}

export async function closeRequest(channelId: string, member: Member, reason: string | null): Promise<Reply> {
  const t = await getTicketByChannel(channelId);
  if (!t) return privateReply("This command only works inside an open support ticket.");
  if (!canClose(member, t.kind)) return privateReply(`Only the ${TICKET_TYPES[t.kind].label} team can request to close this ticket.`);
  const why = reason?.trim();
  return {
    type: 4,
    data: v2(
      [
        text(`<@${t.opener_id}>`),
        container([
          text(
            `### Close Request\n<@${member.user.id}> believes this ticket has been resolved and would like to close it.` +
              (why ? `\n**Reason:** ${clean(why, 300)}` : "") +
              `\n\nIf you have nothing else, please confirm below. If you still need help, choose **Keep Open**.`,
          ),
          {
            type: 1,
            components: [
              { type: 2, style: 4, label: "Close Ticket", custom_id: IDS.closeConfirm },
              { type: 2, style: 2, label: "Keep Open", custom_id: IDS.keepOpen },
            ],
          },
        ], false),
      ],
      { allowed_mentions: { parse: [], users: [t.opener_id] } },
    ),
  };
}

/** "Keep Open" pressed on a close request — swaps the buttons for a note. */
export async function keepOpen(channelId: string, member: Member): Promise<Reply> {
  const t = await getTicketByChannel(channelId);
  if (!t) return privateReply("This ticket is no longer open.");
  if (member.user.id !== t.opener_id && !canClose(member, t.kind)) {
    return privateReply("Only the ticket opener or the support team can answer this.");
  }
  return {
    type: 7, // UPDATE_MESSAGE
    data: {
      components: [
        container([text(`### Close Request Declined\n<@${member.user.id}> chose to keep this ticket open.`)], false),
      ],
      allowed_mentions: { parse: [] },
    },
  };
}

/** /support-panel — the bot posts the panel as its own message in the current channel. */
export async function postPanel(channelId: string): Promise<Reply> {
  try {
    await postChannelMessage(channelId, { components: buildPanel() });
    return privateReply("Support panel posted. ✅");
  } catch (e) {
    console.error("[tickets] panel post failed", e);
    return privateReply("I couldn't post here — make sure I can View Channel and Send Messages in this channel.");
  }
}

/* ------------------------------------------------------------------ */
/* Slash commands (registered from Portal → Discord Bot)                */
/* ------------------------------------------------------------------ */

const reasonOption = (description: string) => ({ type: 3, name: "reason", description, required: false, max_length: 300 });

export const SLASH_COMMANDS = [
  { name: "claim", description: "Claim this support ticket", type: 1, contexts: [0] },
  { name: "close", description: "Close this support ticket", type: 1, contexts: [0], options: [reasonOption("Why the ticket is being closed")] },
  {
    name: "close-request",
    description: "Ask the ticket opener to confirm the ticket can be closed",
    type: 1,
    contexts: [0],
    options: [reasonOption("Why you think the ticket can be closed")],
  },
  {
    name: "support-panel",
    description: "Post the Department Assistance support panel in this channel",
    type: 1,
    contexts: [0],
    default_member_permissions: String(2 ** 5), // Manage Server
  },
];
