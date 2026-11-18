"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({ children, className = "btn btn-gold", pendingText = "Submitting…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
};

export function TextField({ type = "text", placeholder, maxLength, ...p }: FieldProps & { type?: string; placeholder?: string; maxLength?: number }) {
  return (
    <div>
      <label className="field-label" htmlFor={p.name}>
        {p.label} {p.required && <span className="text-destructive">*</span>}
      </label>
      <input
        id={p.name}
        name={p.name}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={p.defaultValue}
        required={p.required}
        aria-invalid={p.error ? true : undefined}
        className="field"
      />
      {p.hint && !p.error && <p className="mt-1 text-sm text-muted-foreground">{p.hint}</p>}
      {p.error && <p className="mt-1 text-sm text-destructive">{p.error}</p>}
    </div>
  );
}

export function TextArea({ rows = 5, placeholder, maxLength, ...p }: FieldProps & { rows?: number; placeholder?: string; maxLength?: number }) {
  return (
    <div>
      <label className="field-label" htmlFor={p.name}>
        {p.label} {p.required && <span className="text-destructive">*</span>}
      </label>
      <textarea
        id={p.name}
        name={p.name}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={p.defaultValue}
        required={p.required}
        aria-invalid={p.error ? true : undefined}
        className="field"
      />
      {p.hint && !p.error && <p className="mt-1 text-sm text-muted-foreground">{p.hint}</p>}
      {p.error && <p className="mt-1 text-sm text-destructive">{p.error}</p>}
    </div>
  );
}

export function SelectField({ options, placeholder = "Select…", ...p }: FieldProps & { options: string[]; placeholder?: string }) {
  return (
    <div>
      <label className="field-label" htmlFor={p.name}>
        {p.label} {p.required && <span className="text-destructive">*</span>}
      </label>
      <select
        id={p.name}
        name={p.name}
        defaultValue={p.defaultValue ?? ""}
        required={p.required}
        aria-invalid={p.error ? true : undefined}
        className="field"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {p.error && <p className="mt-1 text-sm text-destructive">{p.error}</p>}
    </div>
  );
}

export function Checkbox({ name, label, error, defaultChecked }: { name: string; label: React.ReactNode; error?: string; defaultChecked?: boolean }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-[0.97rem]">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-[oklch(33%_0.13_264)]" />
        <span>{label}</span>
      </label>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-gold bg-panel text-foreground",
    error: "border-destructive bg-[oklch(96%_0.03_27)] text-[oklch(40%_0.15_27)]",
    success: "border-success bg-[oklch(96%_0.04_155)] text-[oklch(35%_0.1_155)]",
  }[tone];
  return <div className={`border-l-4 px-5 py-4 ${styles}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
