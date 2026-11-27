"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { getViewer } from "@/lib/session";
import { query, queryOne } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { env } from "@/lib/env";
import { NDA_VERSION } from "@/lib/nda-text";

const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

async function dm(userId: string, body: string, link: string) {
  const { sendDirectMessageV2 } = await import("@/lib/discord-bot");
  const { container, text } = await import("@/lib/components");
  await sendDirectMessageV2(userId, [
    container([
      text(body),
      { type: 1, components: [{ type: 2, style: 5, label: "View agreement", url: link }] },
    ]),
  ]).catch(() => false);
}

/** The invitee signs. */
export async function signNda(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer) return { message: "Your session expired. Please log in again.", values };
  const { currentNdaFor } = await import("@/lib/nda");
  if (await currentNdaFor(viewer.uid)) return { message: "You've already signed this agreement.", values };

  const errors: Record<string, string> = {};
  const fullName = (values.full_name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const signature = (values.signature ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const roblox = (values.roblox ?? "").trim().slice(0, 20) || null;
  if (fullName.split(" ").filter((w) => /[a-z]/i.test(w)).length < 2) errors.full_name = "Enter your full name (first and last).";
  if (!signature) errors.signature = "Type your full name to sign.";
  else if (squash(signature) !== squash(fullName)) errors.signature = "Your signature must match the full name you entered.";
  if (values.agree !== "on") errors.agree = "You must agree to the terms to sign.";
  if (Object.keys(errors).length) return { errors, values, message: "Please fix the highlighted fields." };

  const row = await queryOne<{ id: number }>(
    `INSERT INTO nda_agreements (user_id, username, full_name, roblox, signature, version) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [viewer.uid, viewer.username, fullName, roblox, signature, NDA_VERSION],
  );
  after(() =>
    dm(
      viewer.uid,
      "## Agreement Signed\n" +
        `> Thank you, **${fullName}**. Your **Confidentiality and Employment Agreement** with the Florida Highway Patrol has been received.\n\n` +
        "A Department Representative will countersign it shortly. You'll get another message when it's complete.",
      `${env.baseUrl}/nda`,
    ),
  );
  refresh();
  return { ok: true, ref: String(row!.id), message: "Signed. A Department Representative will countersign it shortly." };
}

/** A Department Representative countersigns (Command Staff and the Office of the Colonel). */
export async function countersignNda(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer || !viewer.can("applications")) return { message: "Only Department Representatives can countersign.", values };
  const id = Number(values.id);
  const signature = (values.rep_signature ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (signature.length < 3) return { errors: { rep_signature: "Type your name to sign." }, values };
  const nda = await queryOne<{ user_id: string; full_name: string }>(
    `UPDATE nda_agreements SET status='countersigned', rep_id=$1, rep_name=$2, rep_signature=$3, rep_signed_at=now()
     WHERE id=$4 AND status='pending' RETURNING user_id, full_name`,
    [viewer.uid, viewer.displayName, signature, id],
  );
  if (!nda) return { message: "This agreement isn't waiting for a countersignature.", values };
  after(() =>
    dm(
      nda.user_id,
      "## Agreement Complete\n" +
        `> Your **Confidentiality and Employment Agreement** has been countersigned by **${signature}** on behalf of the Florida Highway Patrol.\n\n` +
        "Keep it in mind — everything non-public stays confidential. You can view your signed copy any time.",
      `${env.baseUrl}/nda`,
    ),
  );
  refresh();
  return { ok: true, message: "Countersigned. The invitee has been notified." };
}

export async function voidNda(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer || !viewer.can("applications")) throw new Error("Only Department Representatives can do this.");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || null;
  await query(`UPDATE nda_agreements SET status='void', void_reason=$1 WHERE id=$2`, [reason, Number(fd.get("id"))]);
  refresh();
}
