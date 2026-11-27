"use client";

import { fmtCallsign } from "@/lib/callsign";
import { useActionState } from "react";
import { changeCallsign, rosterSync, saveAssignments } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function SyncForms() {
  const [state, action] = useActionState<FormState, FormData>(rosterSync, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="mode" value="sync" />
        <p className="text-muted-foreground">
          Gives anyone whose callsign doesn&apos;t match their rank the lowest free number in their rank&apos;s block, releases
          callsigns of people who left, and fixes nicknames to <code>501 | Name</code>.
        </p>
        <SubmitButton className="btn btn-navy" pendingText="Syncing… this can take a minute">Sync now</SubmitButton>
      </form>
      <form action={action} className="space-y-2 border-t border-border pt-4">
        <input type="hidden" name="mode" value="reissue" />
        <p className="text-muted-foreground">
          <strong className="text-destructive">Re-issue all callsigns:</strong> wipes every callsign and numbers everyone
          fresh within their rank&apos;s block, then updates all nicknames. Type <code>REISSUE</code> to confirm.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input name="confirm" className="field max-w-48" placeholder="REISSUE" autoComplete="off" />
          <SubmitButton className="btn btn-danger" pendingText="Re-issuing… this can take a minute">
            Re-issue all callsigns
          </SubmitButton>
        </div>
      </form>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </div>
  );
}

type SlotRow = { callsign: number; rank: string; holder: string | null };
type RankRow = { key: string; label: string; callsigns: string };

function AssignmentInput({ name, value }: { name: string; value?: string }) {
  return (
    <input name={name} defaultValue={value ?? ""} maxLength={80} placeholder="No assignment" className="field !py-1.5" autoComplete="off" />
  );
}

export function AssignmentsForm({
  slots,
  ranks,
  values,
}: {
  slots: SlotRow[];
  ranks: RankRow[];
  values: { slots: Record<string, string>; ranks: Record<string, string> };
}) {
  const [state, action] = useActionState<FormState, FormData>(saveAssignments, {});
  const head = "border-b border-border font-display text-xs uppercase tracking-wider text-navy";
  return (
    <form action={action} className="space-y-6">
      <div>
        <div className="field-label">Command positions — per callsign</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className="w-24 py-2 pr-4">Callsign</th>
                <th className="w-40 py-2 pr-4">Rank</th>
                <th className="w-44 py-2 pr-4">Held by</th>
                <th className="py-2">Assignment</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((r) => (
                <tr key={r.callsign} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    <span className="inline-block min-w-12 rounded-sm bg-navy px-2 py-0.5 text-center font-display tracking-wider text-white">
                      {fmtCallsign(r.callsign)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-semibold text-navy-ink">{r.rank}</td>
                  <td className="truncate py-2 pr-4 text-muted-foreground">{r.holder ?? "Vacant"}</td>
                  <td className="py-1.5">
                    <AssignmentInput name={`s_${r.callsign}`} value={values.slots[String(r.callsign)]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="field-label">Supervisors &amp; patrol — per rank</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className="w-48 py-2 pr-4">Rank</th>
                <th className="w-28 py-2 pr-4">Callsigns</th>
                <th className="py-2">Assignment</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 font-semibold text-navy-ink">{r.label}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{r.callsigns}</td>
                  <td className="py-1.5">
                    <AssignmentInput name={`r_${r.key}`} value={values.ranks[r.key]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Saving…">Save assignments</SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}

export function ChangeCallsignForm({ members }: { members: { id: string; label: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(changeCallsign, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1">
          <span className="field-label">Member</span>
          <select name="member" className="field" defaultValue="">
            <option value="" disabled>
              Choose a member…
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-36">
          <span className="field-label">New callsign</span>
          <input name="callsign" className="field" placeholder="311" autoComplete="off" />
        </label>
        <SubmitButton className="btn btn-navy" pendingText="Changing…">
          Change callsign
        </SubmitButton>
      </div>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
