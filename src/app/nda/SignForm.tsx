"use client";

import { useActionState } from "react";
import { PenLine } from "lucide-react";
import { signNda } from "./actions";
import type { FormState } from "@/lib/forms";
import { Alert, Checkbox, SubmitButton, TextField } from "@/components/ui";

export function SignForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState<FormState, FormData>(signNda, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="card card-gold space-y-5 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl uppercase text-navy-ink">
          <PenLine size={20} /> Sign the agreement
        </h2>
        <p className="text-sm text-muted-foreground">Signing as Discord user @{defaultName}. Today&apos;s date is added automatically.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="full_name" label="Full name (Invitee)" required defaultValue={v.full_name} error={e.full_name} maxLength={80} placeholder="First and last name" />
        <TextField name="roblox" label="Roblox username" defaultValue={v.roblox} maxLength={20} />
      </div>
      <TextField
        name="signature"
        label="Signature"
        required
        defaultValue={v.signature}
        error={e.signature}
        maxLength={80}
        hint="Type your full name again. This is your electronic signature."
      />
      <Checkbox
        name="agree"
        error={e.agree}
        label="I have read the Confidentiality and Employment Agreement above and agree to its terms."
      />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Signing…">
          Sign agreement
        </SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
