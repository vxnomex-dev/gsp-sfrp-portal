"use client";

import { useActionState, useState } from "react";
import { decideApplication } from "@/app/actions";
import { APPLICATION_STATUSES, type FormState } from "@/lib/forms";
import { Alert, Checkbox, SubmitButton } from "@/components/ui";

export function DecisionForm({
  id,
  status,
  notes,
  denialReason,
}: {
  id: number;
  status: string;
  notes: string;
  denialReason: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(decideApplication, {});
  const [choice, setChoice] = useState(status);
  return (
    <form action={action} className="card space-y-4 p-6" key={`${status}-${notes}-${denialReason}`}>
      <h3 className="font-display text-xl uppercase text-navy-ink">Decision</h3>
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="field-label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="field" onChange={(e) => setChoice(e.target.value)}>
          {Object.entries(APPLICATION_STATUSES).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
      </div>
      {choice === "denied" && (
        <div>
          <label className="field-label" htmlFor="reason">
            Reason for denial <span className="text-destructive">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            defaultValue={denialReason}
            rows={4}
            required
            minLength={5}
            maxLength={500}
            aria-invalid={state.errors?.reason ? true : undefined}
            className="field"
            placeholder="Sent to the applicant in their denial DM"
          />
          {state.errors?.reason && <p className="mt-1 text-sm text-destructive">{state.errors.reason}</p>}
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="notes">Internal notes</label>
        <textarea id="notes" name="notes" defaultValue={notes} rows={4} className="field" placeholder="Only visible to reviewers in the portal" />
      </div>
      <Checkbox name="notify" defaultChecked label="DM the applicant when accepted or denied (next steps / denial message)" />
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <SubmitButton className="btn btn-navy w-full" pendingText="Saving…">Save decision</SubmitButton>
    </form>
  );
}
