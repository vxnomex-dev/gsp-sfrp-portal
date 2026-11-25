"use client";

import { useActionState, useState } from "react";
import { saveIaCase } from "./actions";
import type { FormState } from "@/lib/forms";
import { CASE_CATEGORIES, FINDINGS, FINDING_HELP, OUTCOMES, type Finding } from "@/lib/ia-constants";
import { Alert, SubmitButton, TextArea, TextField } from "@/components/ui";

type Employee = { id: string; label: string };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="font-display text-lg uppercase text-navy">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Select({
  name,
  label,
  options,
  value,
  onChange,
  defaultValue,
  error,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <select
        id={name}
        name={name}
        className="field"
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue })}
        aria-invalid={error ? true : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function CaseEditor({
  employees,
  initial,
  caseId,
  reportLabel,
}: {
  employees: Employee[];
  initial: Record<string, string>;
  caseId?: number;
  reportLabel?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveIaCase, {});
  const v = { ...initial, ...(state.ok ? {} : (state.values ?? {})) };
  const e = state.errors ?? {};
  const [subject, setSubject] = useState(v.subject_id ?? "");
  const [finding, setFinding] = useState<Finding>((v.finding as Finding) || "investigating");

  const subjectOptions = [
    { value: "", label: "Choose an employee…" },
    ...employees.map((x) => ({ value: x.id, label: x.label })),
    { value: "other", label: "Someone not listed (former employee, not on the roster)" },
  ];

  return (
    <form action={action} className="space-y-6">
      {caseId && <input type="hidden" name="id" value={caseId} />}
      <input type="hidden" name="report_id" value={v.report_id ?? ""} />

      <Section title="Employee" hint="Who this case is about. It's added to their employee file, which is kept even if they leave the department.">
        <Select
          name="subject_id"
          label="Employee"
          required
          options={subjectOptions}
          value={subject}
          onChange={setSubject}
          error={e.subject_id}
        />
        {subject === "other" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="other_name" label="Name" required defaultValue={v.other_name} error={e.other_name} maxLength={80} />
            <TextField
              name="other_id"
              label="Discord user ID"
              required
              defaultValue={v.other_id}
              error={e.other_id}
              maxLength={21}
              hint="Developer Mode → right-click them → Copy User ID"
            />
            <TextField name="other_callsign" label="Callsign (if any)" defaultValue={v.other_callsign} maxLength={20} />
          </div>
        )}
      </Section>

      <Section title="Complaint" hint={reportLabel ? `Filled in from ${reportLabel}. Correct anything that's wrong.` : "Who reported it and what was reported."}>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="reporter_username" label="Reporter Discord username" defaultValue={v.reporter_username} maxLength={80} />
          <TextField name="reporter_discord_id" label="Reporter Discord ID" defaultValue={v.reporter_discord_id} maxLength={30} />
          <TextField name="reporter_roblox" label="Reporter Roblox username" defaultValue={v.reporter_roblox} maxLength={40} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="incident_date" label="Date of incident" defaultValue={v.incident_date} maxLength={40} />
          <TextField name="location" label="Location" defaultValue={v.location} maxLength={200} />
          <Select
            name="category"
            label="Category"
            defaultValue={v.category ?? ""}
            options={[{ value: "", label: "Choose…" }, ...CASE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <TextField
          name="reason"
          label="Reason for report / allegation"
          required
          defaultValue={v.reason}
          error={e.reason}
          maxLength={300}
          placeholder="e.g. Excessive force during a traffic stop on Freedom Ave"
        />
        <TextArea name="complainant_statement" label="Reporter's statement" rows={6} defaultValue={v.complainant_statement} maxLength={5000} />
      </Section>

      <Section title="Statements">
        <TextArea
          name="trooper_statement"
          label="Trooper's statement"
          rows={6}
          defaultValue={v.trooper_statement}
          maxLength={5000}
          placeholder="Their account, in their own words, from the interview."
        />
        <TextArea name="witness_statements" label="Witness statements (optional)" rows={4} defaultValue={v.witness_statements} maxLength={5000} />
      </Section>

      <Section title="Evidence">
        <TextArea
          name="evidence"
          label="Evidence"
          rows={4}
          defaultValue={v.evidence}
          maxLength={3000}
          hint="Clips, screenshots and links — one per line."
        />
        <TextField
          name="recording_url"
          label="Craig recording"
          type="url"
          defaultValue={v.recording_url}
          error={e.recording_url}
          maxLength={500}
          placeholder="https://craig.horse/rec/…"
          hint="Record the interview with Craig (/join, then /stop) and paste the download link it DMs you."
        />
      </Section>

      <Section title="Finding & outcome">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Select
              name="finding"
              label="Finding"
              required
              value={finding}
              onChange={(x) => setFinding(x as Finding)}
              error={e.finding}
              options={(Object.keys(FINDINGS) as Finding[]).map((k) => ({ value: k, label: FINDINGS[k].label }))}
            />
            <p className="mt-1 text-sm text-muted-foreground">{FINDING_HELP[finding]}</p>
          </div>
          <Select
            name="outcome"
            label="Initial outcome / punishment"
            defaultValue={v.outcome || "Pending"}
            options={OUTCOMES.map((o) => ({ value: o, label: o }))}
          />
        </div>
        <TextField
          name="outcome_details"
          label="Outcome details"
          defaultValue={v.outcome_details}
          maxLength={500}
          placeholder="e.g. 3-day suspension, issued as infraction #42"
          hint="Issue the actual infraction with /infraction in Discord — it shows up on their file automatically."
        />
        <TextArea name="investigator_notes" label="Investigator notes" rows={4} defaultValue={v.investigator_notes} maxLength={5000} />
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Saving…">
          {caseId ? "Save case" : "Open case"}
        </SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
