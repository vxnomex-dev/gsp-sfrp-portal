"use client";

import { useActionState, useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { managerWipeShifts, toggleMyShift } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** Counts up from `since` every second, plus `base` seconds already done. */
export function LiveTimer({ since, base = 0, className }: { since: string; base?: number; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect -- start the clock after load
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={className}>{now === null ? "…" : fmt(base + (now - new Date(since).getTime()) / 1000)}</span>;
}

export function ShiftToggle({ onDuty }: { onDuty: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(() => toggleMyShift(), {});
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className={onDuty ? "btn btn-danger" : "btn btn-gold"} pendingText={onDuty ? "Ending…" : "Starting…"}>
        {onDuty ? (
          <>
            <Square size={16} /> End shift
          </>
        ) : (
          <>
            <Play size={16} /> Start shift
          </>
        )}
      </SubmitButton>
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}

export function WipeAllForm() {
  const [state, action] = useActionState<FormState, FormData>(managerWipeShifts, {});
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline">
          Wipe shifts…
        </button>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="scope" value="all" />
          <span className="text-sm text-muted-foreground">Clears shift time for everyone you manage. Type WIPE:</span>
          <input name="confirm" className="field max-w-28 !py-1.5" placeholder="WIPE" autoComplete="off" />
          <SubmitButton className="btn btn-danger !py-1.5" pendingText="Wiping…">
            Wipe
          </SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground underline">
            Cancel
          </button>
        </form>
      )}
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </div>
  );
}

export function WipeOneButton({ userId, name }: { userId: string; name: string }) {
  const [, action] = useActionState<FormState, FormData>(managerWipeShifts, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Wipe all shift time for ${name}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="user" value={userId} />
      <button className="btn btn-outline !px-2.5 !py-1 text-xs">Wipe time</button>
    </form>
  );
}
