import { after, NextResponse, type NextRequest } from "next/server";
import { verifyDiscordRequest, editInteractionOriginal, ephemeralFollowup } from "@/lib/discord-bot";
import {
  ACCEPT_PREFIX,
  DENY_PREFIX,
  DENY_MODAL_PREFIX,
  DENY_REASON_INPUT,
  buildApplicationMessage,
  denyReasonModal,
  recordDecision,
} from "@/lib/applications-discord";
import {
  IDS,
  TICKET_TYPES,
  claimTicket,
  closeRequest,
  finishClose,
  inquiryModal,
  keepOpen,
  openTicket,
  postPanel,
  privateReply,
  renameTicket,
  startClose,
  type Member,
  type TicketKind,
} from "@/lib/tickets";
import { resolveAccess } from "@/lib/permissions";
import { appRef } from "@/lib/forms";

/**
 * Discord sends button clicks, menu choices, pop-up submissions and slash commands here.
 * Developer Portal → General Information → Interactions Endpoint URL:
 *   https://gspsfrp.xyz/api/discord/interactions
 */

export const maxDuration = 30;

type ModalRow = { components?: { custom_id: string; value: string }[]; component?: { custom_id: string; value: string } };

type Interaction = {
  type: number;
  token: string;
  channel_id?: string;
  channel?: { id: string };
  data?: {
    name?: string;
    custom_id?: string;
    values?: string[];
    options?: { name: string; value: string }[];
    components?: ModalRow[];
  };
  member?: Member;
};

const json = (body: unknown) => NextResponse.json(body);
const ephemeral = (content: string) => json(privateReply(content));

/** Reads a text input's value from a modal submission (supports both Discord modal layouts). */
function modalValue(i: Interaction, id: string): string {
  for (const row of i.data?.components ?? []) {
    for (const c of [...(row.components ?? []), ...(row.component ? [row.component] : [])]) {
      if (c.custom_id === id) return c.value ?? "";
    }
  }
  return "";
}

const option = (i: Interaction, name: string) => i.data?.options?.find((o) => o.name === name)?.value ?? null;

/* ---------------- Cadet applications ---------------- */

function decideLater(i: Interaction, id: number, status: "accepted" | "denied", reason: string | null) {
  const reviewer = i.member!.user;
  const reviewerName = i.member!.nick || reviewer.global_name || reviewer.username;

  after(async () => {
    try {
      const result = await recordDecision({
        id,
        status,
        reason,
        reviewerId: reviewer.id,
        reviewerName,
        onlyIfOpen: true,
        notify: true,
        skipMessageEdit: true,
      });

      if (!result.ok) {
        if (result.reason === "already_decided" && result.app) {
          await editInteractionOriginal(i.token, {
            components: buildApplicationMessage(result.app, { withButtons: true }).components,
          }).catch(() => {});
          await ephemeralFollowup(
            i.token,
            `${appRef(id)} was already **${result.app.status}** by ${result.app.reviewer_name ?? "another reviewer"}.`,
          );
        } else {
          await ephemeralFollowup(i.token, `Couldn't find application ${appRef(id)}.`);
        }
        return;
      }

      await editInteractionOriginal(i.token, {
        components: buildApplicationMessage(result.app, { withButtons: true }).components,
      });
      if (result.dmSent === false) {
        await ephemeralFollowup(
          i.token,
          `Saved, but I couldn't DM <@${result.app.discord_id}> — their DMs may be closed. Please let them know manually.`,
        );
      }
    } catch (e) {
      console.error("[interactions] decision failed", e);
      await ephemeralFollowup(i.token, "Something went wrong saving that decision. Please try again or use the portal.");
    }
  });
}

async function handleApplication(i: Interaction, cid: string) {
  if (!resolveAccess(i.member!.roles).permissions.includes("applications")) {
    return ephemeral("You don't have permission to decide cadet applications.");
  }
  if (i.type === 3 && cid.startsWith(ACCEPT_PREFIX)) {
    decideLater(i, Number(cid.slice(ACCEPT_PREFIX.length)), "accepted", null);
    return json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
  }
  if (i.type === 3 && cid.startsWith(DENY_PREFIX)) {
    return json(denyReasonModal(Number(cid.slice(DENY_PREFIX.length))));
  }
  if (i.type === 5 && cid.startsWith(DENY_MODAL_PREFIX)) {
    const reason = modalValue(i, DENY_REASON_INPUT).trim();
    if (reason.length < 5) return ephemeral("Please give a reason for the denial (at least 5 characters).");
    decideLater(i, Number(cid.slice(DENY_MODAL_PREFIX.length)), "denied", reason.slice(0, 500));
    return json({ type: 6 });
  }
  return ephemeral("Unknown action.");
}

/* ---------------- Support tickets ---------------- */

async function close(i: Interaction, channelId: string, reason: string | null, byOpener: boolean) {
  const res = await startClose(channelId, i.member!, reason, { byOpener });
  if (res.ticket) {
    const t = res.ticket;
    after(() => finishClose(t, i.member!, res.reason!));
  }
  return json(res.reply);
}

/* ---------------- Entry point ---------------- */

export async function POST(req: NextRequest) {
  const body = await req.text();
  const ok = verifyDiscordRequest(
    req.headers.get("x-signature-ed25519"),
    req.headers.get("x-signature-timestamp"),
    body,
  );
  if (!ok) return new NextResponse("invalid request signature", { status: 401 });

  const i = JSON.parse(body) as Interaction;

  // PING — Discord checks the endpoint works when you save it in the Developer Portal
  if (i.type === 1) return json({ type: 1 });

  if (!i.member) return ephemeral("This only works inside the server.");
  const channelId = i.channel_id ?? i.channel?.id ?? "";
  const cid = i.data?.custom_id ?? "";

  try {
    // Slash commands
    if (i.type === 2) {
      switch (i.data?.name) {
        case "claim":
          return json(await claimTicket(channelId, i.member));
        case "close":
          return close(i, channelId, option(i, "reason"), false);
        case "close-request":
          return json(await closeRequest(channelId, i.member, option(i, "reason")));
        case "rename":
          return json(await renameTicket(channelId, i.member, option(i, "name") ?? ""));
        case "support-panel":
          return json(await postPanel(channelId));
        default:
          return ephemeral("Unknown command.");
      }
    }

    // Cadet application buttons / pop-up
    if ([ACCEPT_PREFIX, DENY_PREFIX, DENY_MODAL_PREFIX].some((p) => cid.startsWith(p))) {
      return handleApplication(i, cid);
    }

    // Support panel: support type picked → show the "What's up?" pop-up
    if (i.type === 3 && cid === IDS.panelSelect) {
      const kind = i.data?.values?.[0] as TicketKind;
      if (!TICKET_TYPES[kind]) return ephemeral("Unknown support type.");
      return json(inquiryModal(kind));
    }

    // "What's up?" submitted → open the ticket
    if (i.type === 5 && cid.startsWith(IDS.modalPrefix)) {
      const kind = cid.slice(IDS.modalPrefix.length) as TicketKind;
      if (!TICKET_TYPES[kind]) return ephemeral("Unknown support type.");
      const inquiry = modalValue(i, IDS.modalInput).trim().slice(0, 1000);
      if (inquiry.length < 5) return ephemeral("Please tell us a little more about what you need.");
      after(() => openTicket(i.token, kind, i.member!, inquiry));
      return json({ type: 5, data: { flags: 64 } }); // private "thinking…" while the channel is created
    }

    // Ticket buttons
    if (i.type === 3) {
      if (cid === IDS.claim) return json(await claimTicket(channelId, i.member));
      if (cid === IDS.close) return close(i, channelId, null, false);
      if (cid === IDS.closeConfirm) return close(i, channelId, "Close request confirmed.", true);
      if (cid === IDS.keepOpen) return json(await keepOpen(channelId, i.member));
    }
  } catch (e) {
    console.error("[interactions] failed", e);
    return ephemeral("Something went wrong. Please try again.");
  }

  return ephemeral("Unknown action.");
}
