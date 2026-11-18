import { after, NextResponse, type NextRequest } from "next/server";
import { verifyDiscordRequest, editInteractionOriginal, ephemeralFollowup } from "@/lib/discord-bot";
import { ACCEPT_PREFIX, DENY_PREFIX, buildApplicationMessage, recordDecision } from "@/lib/applications-discord";
import { resolveAccess } from "@/lib/permissions";
import { appRef } from "@/lib/forms";

/**
 * Discord sends button clicks here.
 * Set this URL in the Developer Portal → General Information → Interactions Endpoint URL:
 *   https://gspsfrp.xyz/api/discord/interactions
 */

export const maxDuration = 30;

type Interaction = {
  type: number;
  token: string;
  data?: { custom_id?: string };
  member?: { roles: string[]; nick?: string | null; user: { id: string; username: string; global_name?: string | null } };
  user?: { id: string; username: string };
};

const ephemeral = (content: string) =>
  NextResponse.json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });

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

  // Button clicks
  if (i.type === 3 && i.data?.custom_id) {
    const cid = i.data.custom_id;
    const isAccept = cid.startsWith(ACCEPT_PREFIX);
    const isDeny = cid.startsWith(DENY_PREFIX);
    if (!isAccept && !isDeny) return ephemeral("Unknown button.");

    if (!i.member) return ephemeral("These buttons only work inside the server.");
    const { permissions } = resolveAccess(i.member.roles);
    if (!permissions.includes("applications")) {
      return ephemeral("You don't have permission to decide cadet applications.");
    }

    const id = Number(cid.slice((isAccept ? ACCEPT_PREFIX : DENY_PREFIX).length));
    const reviewer = i.member.user;
    const reviewerName = i.member.nick || reviewer.global_name || reviewer.username;

    // Answer Discord immediately ("deferred update"), then do the slow work.
    after(async () => {
      try {
        const result = await recordDecision({
          id,
          status: isAccept ? "accepted" : "denied",
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

    return NextResponse.json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
  }

  return ephemeral("Unsupported interaction.");
}
