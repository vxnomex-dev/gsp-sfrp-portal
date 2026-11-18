"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitReport } from "@/app/actions";
import { REPORT_CATEGORIES, type FormState } from "@/lib/forms";
import { Alert, Checkbox, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui";

export function ReportForm({ discordName }: { discordName: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitReport, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="card card-gold p-10 text-center">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h2 className="mt-4 text-3xl font-semibold uppercase text-navy-ink">Report received</h2>
        <p className="mt-3 text-muted-foreground">
          Your case number is <strong className="text-navy-ink">{state.ref}</strong>. The Professional Standards Bureau
          has been notified. An investigator may contact you on Discord if they need more information.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-8 p-6 md:p-8" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <fieldset className="space-y-6">
        <legend className="mb-4 font-display text-xl uppercase text-navy-ink">About you</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <span className="field-label">Discord account</span>
            <div className="field bg-muted text-muted-foreground">@{discordName}</div>
          </div>
          <TextField name="reporter_roblox" label="Your Roblox username" required maxLength={20} defaultValue={v.reporter_roblox} error={e.reporter_roblox} />
        </div>
      </fieldset>

      <fieldset className="space-y-6 border-t border-border pt-6">
        <legend className="mb-4 pt-6 font-display text-xl uppercase text-navy-ink">The trooper</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField name="trooper_name" label="Trooper name" required placeholder="Name, or describe them if unknown" defaultValue={v.trooper_name} error={e.trooper_name} />
          <TextField name="trooper_identifier" label="Callsign, badge # or Roblox name" placeholder="If known" defaultValue={v.trooper_identifier} error={e.trooper_identifier} />
        </div>
      </fieldset>

      <fieldset className="space-y-6 border-t border-border pt-6">
        <legend className="mb-4 pt-6 font-display text-xl uppercase text-navy-ink">The incident</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField name="incident_date" label="Date of incident" type="date" required defaultValue={v.incident_date} error={e.incident_date} />
          <TextField name="location" label="Location in game" placeholder="e.g. Route 1 near the gas station" defaultValue={v.location} error={e.location} />
        </div>
        <SelectField name="category" label="Type of complaint" required options={REPORT_CATEGORIES} defaultValue={v.category} error={e.category} />
        <TextArea name="description" label="What happened?" rows={7} required maxLength={3000} hint="Be specific: what was said or done, and who else was involved. Minimum 50 characters." defaultValue={v.description} error={e.description} />
        <TextArea name="evidence" label="Evidence links" rows={3} maxLength={1000} placeholder="Paste links to clips or screenshots, one per line" defaultValue={v.evidence} error={e.evidence} />
      </fieldset>

      <Checkbox
        name="truthful"
        defaultChecked={v.truthful === "on"}
        error={e.truthful}
        label="I confirm this report is truthful and accurate to the best of my knowledge."
      />

      <div className="flex justify-end border-t border-border pt-6">
        <SubmitButton className="btn btn-navy">
          Submit report <Send size={16} />
        </SubmitButton>
      </div>
    </form>
  );
}
