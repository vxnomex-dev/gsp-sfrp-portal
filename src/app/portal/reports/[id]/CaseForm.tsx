"use client";

import { useActionState } from "react";
import { updateReport } from "@/app/actions";
import { REPORT_STATUSES, type FormState } from "@/lib/forms";
import { Alert, Checkbox, SubmitButton } from "@/components/ui";

export function CaseForm({ id, status, notes, assigned }: { id: number; status: string; notes: string; assigned: "me" | "other" | "none" }) {
  const [state, action] = useActionState<FormState, FormData>(updateReport, {});
  return (
    <form action={action} className="card space-y-4 p-6" key={`${status}-${notes}-${assigned}`}>
      <h3 className="font-display text-xl uppercase text-navy-ink">Case management</h3>
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="field-label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="field">
          {Object.entries(REPORT_STATUSES).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Investigation notes</label>
        <textarea id="notes" name="notes" defaultValue={notes} rows={7} className="field" placeholder="Findings, interviews, outcome (HR only)" />
      </div>
      {assigned !== "me" && (
        <Checkbox
          name="assign"
          defaultChecked={assigned === "none"}
          label={assigned === "none" ? "Assign this case to me" : "Reassign this case to me"}
        />
      )}
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <SubmitButton className="btn btn-navy w-full" pendingText="Saving…">Update case</SubmitButton>
    </form>
  );
}
