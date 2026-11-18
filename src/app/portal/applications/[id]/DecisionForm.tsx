"use client";

import { useActionState } from "react";
import { decideApplication } from "@/app/actions";
import { APPLICATION_STATUSES, type FormState } from "@/lib/forms";
import { Alert, Checkbox, SubmitButton } from "@/components/ui";

export function DecisionForm({ id, status, notes }: { id: number; status: string; notes: string }) {
  const [state, action] = useActionState<FormState, FormData>(decideApplication, {});
  return (
    <form action={action} className="card space-y-4 p-6" key={`${status}-${notes}`}>
      <h3 className="font-display text-xl uppercase text-navy-ink">Decision</h3>
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="field-label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="field">
          {Object.entries(APPLICATION_STATUSES).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Internal notes</label>
        <textarea id="notes" name="notes" defaultValue={notes} rows={5} className="field" placeholder="Only visible to reviewers in the portal" />
      </div>
      <Checkbox name="notify" defaultChecked label="DM the applicant when accepted or denied (next steps / denial message)" />
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <SubmitButton className="btn btn-navy w-full" pendingText="Saving…">Save decision</SubmitButton>
    </form>
  );
}
