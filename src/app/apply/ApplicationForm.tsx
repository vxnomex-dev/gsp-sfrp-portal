"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitApplication } from "@/app/actions";
import { AVAILABILITY_OPTIONS, CADET_QUESTIONS, type FormState } from "@/lib/forms";
import { Alert, Checkbox, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui";

export function ApplicationForm({ discordName }: { discordName: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitApplication, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="card card-gold p-10 text-center">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h2 className="mt-4 text-3xl font-semibold uppercase text-navy-ink">Application submitted</h2>
        <p className="mt-3 text-muted-foreground">
          Your reference number is <strong className="text-navy-ink">{state.ref}</strong>. Command staff have been
          notified and will review your application. Keep your Discord DMs open so we can reach you.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-6 p-6 md:p-8" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <span className="field-label">Discord account</span>
          <div className="field bg-muted text-muted-foreground">@{discordName}</div>
        </div>
        <TextField name="roblox_username" label="Roblox username" required maxLength={20} defaultValue={v.roblox_username} error={e.roblox_username} />
        <TextField name="age" label="Age" type="number" required defaultValue={v.age} error={e.age} />
        <TextField name="timezone" label="Timezone" required placeholder="e.g. EST, CST, GMT" defaultValue={v.timezone} error={e.timezone} />
      </div>
      <SelectField name="availability" label="How active can you be?" required options={AVAILABILITY_OPTIONS} defaultValue={v.availability} error={e.availability} />

      {CADET_QUESTIONS.map((q) => (
        <TextArea
          key={q.key}
          name={q.key}
          label={q.label}
          required={q.min > 0}
          maxLength={2000}
          defaultValue={v[q.key]}
          error={e[q.key]}
          hint={q.min ? `Minimum ${q.min} characters.` : undefined}
        />
      ))}

      <Checkbox
        name="agree"
        defaultChecked={v.agree === "on"}
        error={e.agree}
        label="I confirm my answers are my own work, and I agree to follow the Georgia State Patrol's policies and the South Fulton Roleplay server rules."
      />

      <div className="flex justify-end border-t border-border pt-6">
        <SubmitButton>
          Submit application <Send size={16} />
        </SubmitButton>
      </div>
    </form>
  );
}
