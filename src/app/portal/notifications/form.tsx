"use client";

import { useActionState, useState } from "react";
import { Megaphone, Siren, Info } from "lucide-react";
import { publishNotification } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, Checkbox, SubmitButton, TextArea, TextField } from "@/components/ui";

const icons = { alert: Siren, press: Megaphone, info: Info } as Record<string, typeof Siren>;

type Editing = { id: number; kind: string; alert_type: string; title: string; body: string };

export function ComposeForm({
  kinds: allKinds,
  alertTypes,
  editing,
}: {
  kinds: { key: string; label: string; blurb: string }[];
  alertTypes: { key: string; label: string }[];
  editing: Editing | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(publishNotification, {});
  const kinds = editing ? allKinds.filter((k) => k.key === editing.kind) : allKinds;
  const [kind, setKind] = useState(state.values?.kind ?? editing?.kind ?? kinds[0]?.key ?? "");
  const start: Record<string, string> = editing ? { title: editing.title, body: editing.body, alert_type: editing.alert_type } : {};
  const v = state.ok && !editing ? {} : { ...start, ...(state.values ?? {}) };
  const e = state.errors ?? {};

  return (
    // A new key after publishing clears the form
    <form key={state.ok && !editing ? `done-${state.ref}` : "form"} action={action} className="space-y-5">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div>
        <div className="field-label">What are you publishing?</div>
        <div className={`grid gap-3 ${kinds.length > 1 ? "sm:grid-cols-3" : ""}`}>
          {kinds.map((k) => {
            const Icon = icons[k.key] ?? Info;
            const active = kind === k.key;
            return (
              <label
                key={k.key}
                className={`cursor-pointer rounded-sm border-2 p-4 transition-colors ${active ? "border-gold bg-panel" : "border-border hover:border-navy"}`}
              >
                <input type="radio" name="kind" value={k.key} checked={active} onChange={() => setKind(k.key)} className="sr-only" />
                <span className="flex items-center gap-2 font-display uppercase tracking-wide text-navy-ink">
                  <Icon size={18} className={k.key === "alert" ? "text-destructive" : "text-navy"} /> {k.label}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{k.blurb}</span>
              </label>
            );
          })}
        </div>
      </div>

      {kind === "alert" && (
        <div>
          <div className="field-label">
            Alert type <span className="text-destructive">*</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertTypes.map((a) => (
              <label key={a.key} className="cursor-pointer">
                <input type="radio" name="alert_type" value={a.key} defaultChecked={v.alert_type === a.key} className="peer sr-only" />
                <span className="inline-block rounded-sm border border-border bg-card px-3 py-1.5 font-display text-sm uppercase tracking-wide text-navy peer-checked:border-destructive peer-checked:bg-destructive peer-checked:text-white">
                  {a.label}
                </span>
              </label>
            ))}
          </div>
          {e.alert_type && <p className="mt-1 text-sm text-destructive">{e.alert_type}</p>}
        </div>
      )}

      <TextField
        name="title"
        label="Headline"
        required
        maxLength={150}
        defaultValue={v.title}
        error={e.title}
        placeholder={kind === "alert" ? "e.g. Missing 8-year-old last seen near Springfield Ave" : kind === "press" ? "e.g. Update: Felony Speeding Arrest on Freedom Avenue" : "e.g. Mandatory department meeting Saturday"}
      />
      <TextArea
        name="body"
        label="Details"
        required
        rows={kind === "press" ? 14 : 8}
        maxLength={3000}
        defaultValue={v.body}
        error={e.body}
        hint={
          kind === "alert"
            ? "Include descriptions, vehicle and plate, last known location, and what the public should do."
            : kind === "press"
              ? "Start with a greeting (e.g. “Hello to the citizens of Florida,”) and leave a blank line between paragraphs. It's laid out as an official release, signed by you as PIO, and posted in the press channel on Discord."
              : undefined
        }
      />
      {!editing && (
        <Checkbox name="send_dms" label="DM everyone who subscribed to this type" defaultChecked={v.send_dms ? v.send_dms === "on" : true} />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className={kind === "alert" ? "btn btn-danger" : "btn btn-navy"} pendingText={editing ? "Saving…" : "Publishing…"}>
          {editing ? "Save changes" : kind === "alert" ? "Issue alert" : "Publish"}
        </SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
