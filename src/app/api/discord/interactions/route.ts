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
import { resolveAccess } from "@/lib/permissions";
import { appRef } from "@/lib/forms";

/**
 * Discord sends button clicks and pop-up (modal) submissions here.
 * Developer Portal → General Information → Interactions Endpoint URL:
 *   https://gspsfrp.xyz/api/discord/interactions
 */

export const maxDuration = 30;

type ModalRow = { components?: { custom_id: string; value: string }[]; component?: { custom_id: string; value: string } };

type Interaction = {
  type: number;
  token: string;
  data?: { custom_id?: string; components?: ModalRow[] };
  member?: { roles: string[]; nick?: string | null; user: { id: string; username: string; global_name?: string | null } };
};

const ephemeral = (content: string) =>
  NextResponse.json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });

/** Reads a text input's value from a modal submission (supports both Discord modal layouts). */
function modalValue(i: Interaction, id: string): string {
  for (const row of i.data?.components ?? []) {
    for (const c of [...(row.components ?? []), ...(row.component ? [row.component] : [])]) {
      if (c.custom_id === id) return c.value ?? "";
    }
  }
  return "";
}

/** Saves the decision after Discord has been answered, then updates the message and reports problems privately. */
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
  if (i.type === 1) return NextResponse.json({ type: 1 });

  const cid = i.data?.custom_id ?? "";
  const isButton = i.type === 3;
  const isModal = i.type === 5;
  if (!isButton && !isModal) return ephemeral("Unsupported interaction.");

  const ours = [ACCEPT_PREFIX, DENY_PREFIX, DENY_MODAL_PREFIX].some((p) => cid.startsWith(p));
  if (!ours) return ephemeral("Unknown action.");

  if (!i.member) return ephemeral("This only works inside the server.");
  if (!resolveAccess(i.member.roles).permissions.includes("applications")) {
    return ephemeral("You don't have permission to decide cadet applications.");
  }

  // ✅ Accept button
  if (isButton && cid.startsWith(ACCEPT_PREFIX)) {
    decideLater(i, Number(cid.slice(ACCEPT_PREFIX.length)), "accepted", null);
    return NextResponse.json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
  }

  // ✖️ Deny button → ask for a reason first
  if (isButton && cid.startsWith(DENY_PREFIX)) {
    return NextResponse.json(denyReasonModal(Number(cid.slice(DENY_PREFIX.length))));
  }

  // Reason submitted → deny
  if (isModal && cid.startsWith(DENY_MODAL_PREFIX)) {
    const reason = modalValue(i, DENY_REASON_INPUT).trim();
    if (reason.length < 5) return ephemeral("Please give a reason for the denial (at least 5 characters).");
    decideLater(i, Number(cid.slice(DENY_MODAL_PREFIX.length)), "denied", reason.slice(0, 500));
    return NextResponse.json({ type: 6 });
  }

  return ephemeral("Unknown action.");
}
