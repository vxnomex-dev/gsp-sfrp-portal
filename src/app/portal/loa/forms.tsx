"use client";

import { useActionState, useState } from "react";
import { decideLoaWeb, requestLoa } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function LoaForm({ today }: { today: string }) {
  const [state, action] = useActionState<FormState, FormData>(requestLoa, {});
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <form key={state.ok ? `sent-${state.ref}` : "form"} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">First day</span>
          <input type="date" name="start" min={today} defaultValue={v.start} required className="field" />
        </label>
        <label>
          <span className="field-label">Last day</span>
          <input type="date" name="end" min={today} defaultValue={v.end} required className="field" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Reason</span>
        <textarea name="reason" rows={4} maxLength={1000} defaultValue={v.reason} required className="field" placeholder="Why do you need the leave?" />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Sending…">
          Send request
        </SubmitButton>
      </div>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}

export function DecideButtons({ id }: { id: number }) {
  const [denying, setDenying] = useState(false);
  if (denying) {
    return (
      <form action={decideLoaWeb} className="flex flex-wrap justify-end gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="denied" />
        <input name="reason" required minLength={3} maxLength={400} className="field !py-1 text-sm" placeholder="Reason for denial" />
        <SubmitButton className="btn btn-danger !px-2.5 !py-1 text-xs" pendingText="…">
          Deny
        </SubmitButton>
        <button type="button" onClick={() => setDenying(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </form>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <form action={decideLoaWeb}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="approved" />
        <SubmitButton className="btn btn-navy !px-2.5 !py-1 text-xs" pendingText="…">
          Approve
        </SubmitButton>
      </form>
      <button type="button" onClick={() => setDenying(true)} className="btn btn-outline !px-2.5 !py-1 text-xs">
        Deny
      </button>
    </div>
  );
}
