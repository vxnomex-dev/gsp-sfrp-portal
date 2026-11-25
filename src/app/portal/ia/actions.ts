"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getViewer } from "@/lib/session";
import type { FormState } from "@/lib/forms";

const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;

const opt = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim().slice(0, max);
  return t || null;
};

/** Create (no id) or update (id) an Internal Affairs case. */
export async function saveIaCase(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const viewer = await getViewer();
  if (!viewer || !viewer.can("ia")) return { message: "Only Internal Affairs can do this.", values };
  const ia = await import("@/lib/ia");

  const errors: Record<string, string> = {};
  let subjectId = values.subject_id ?? "";
  let subjectName = "";
  let subjectCallsign: string | null = null;
  let subjectRank: string | null = null;

  if (subjectId === "other") {
    subjectId = (values.other_id ?? "").trim();
    subjectName = (values.other_name ?? "").trim().slice(0, 80);
    if (!/^\d{15,21}$/.test(subjectId)) errors.other_id = "Enter their Discord user ID (Developer Mode → right-click → Copy User ID).";
    if (!subjectName) errors.other_name = "Enter their name.";
    subjectCallsign = opt(values.other_callsign, 20);
  } else if (subjectId) {
    const emp = (await ia.currentEmployees()).find((e) => e.id === subjectId);
    if (emp) {
      subjectName = emp.name;
      subjectCallsign = emp.callsign;
      subjectRank = emp.rank;
    } else {
      // Editing a case about someone who has since left: keep what's on the case
      const existing = values.id ? await ia.getCase(Number(values.id)) : null;
      if (existing && existing.subject_id === subjectId) {
        subjectName = existing.subject_name;
        subjectCallsign = existing.subject_callsign;
        subjectRank = existing.subject_rank;
      } else errors.subject_id = "That employee isn't on the roster. Choose \"Someone not listed\" instead.";
    }
  } else errors.subject_id = "Choose the employee this case is about.";

  const reason = (values.reason ?? "").trim();
  if (reason.length < 3) errors.reason = "Say what the case is about.";
  const recording = opt(values.recording_url, 500);
  if (recording && !/^https?:\/\//i.test(recording)) errors.recording_url = "Paste the full link, starting with https://";
  if (!ia.isFinding(values.finding)) errors.finding = "Choose a finding.";
  const outcome = (ia.OUTCOMES as readonly string[]).includes(values.outcome) ? values.outcome : "Pending";

  if (Object.keys(errors).length) return { errors, values, message: "Please fix the highlighted fields." };

  const input = {
    report_id: Number(values.report_id) > 0 ? Number(values.report_id) : null,
    subject_id: subjectId,
    subject_name: subjectName,
    subject_callsign: subjectCallsign,
    subject_rank: subjectRank,
    reporter_username: opt(values.reporter_username, 80),
    reporter_discord_id: opt(values.reporter_discord_id, 30),
    reporter_roblox: opt(values.reporter_roblox, 40),
    incident_date: opt(values.incident_date, 40),
    location: opt(values.location, 200),
    category: opt(values.category, 80),
    reason: reason.slice(0, 300),
    complainant_statement: opt(values.complainant_statement, 5000),
    trooper_statement: opt(values.trooper_statement, 5000),
    witness_statements: opt(values.witness_statements, 5000),
    evidence: opt(values.evidence, 3000),
    recording_url: recording,
    finding: values.finding as import("@/lib/ia").Finding,
    outcome,
    outcome_details: opt(values.outcome_details, 500),
    investigator_notes: opt(values.investigator_notes, 5000),
  };

  if (values.id) {
    const c = await ia.updateCase(Number(values.id), input);
    if (!c) return { message: "That case no longer exists.", values };
    refresh();
    return { ok: true, message: `${ia.iaRef(c.id)} saved.` };
  }
  const c = await ia.createCase(input, { id: viewer.uid, name: viewer.displayName });
  redirect(`/portal/ia/cases/${c.id}?created=1`);
}

export async function deleteIaCase(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer || !viewer.can("ia")) throw new Error("Only Internal Affairs can do this.");
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return;
  const { deleteCase } = await import("@/lib/ia");
  await deleteCase(Number(fd.get("id")));
  redirect("/portal/ia");
}
