"use client";

import { useActionState } from "react";
import { countersignNda } from "@/app/nda/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton, TextField } from "@/components/ui";

export function CountersignForm({ id, defaultName }: { id: number; defaultName: string }) {
  const [state, action] = useActionState<FormState, FormData>(countersignNda, {});
  return (
    <form action={action} className="card card-gold space-y-4 p-5">
      <input type="hidden" name="id" value={id} />
      <div className="font-display text-lg uppercase text-navy-ink">Countersign</div>
      <TextField
        name="rep_signature"
        label="Department Representative signature"
        required
        defaultValue={state.values?.rep_signature ?? defaultName}
        error={state.errors?.rep_signature}
        maxLength={80}
        hint="Type your name. It's signed on behalf of the Florida Highway Patrol with today's date."
      />
      <SubmitButton className="btn btn-navy w-full" pendingText="Signing…">
        Countersign agreement
      </SubmitButton>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
