"use client";

import { useActionState } from "react";
import { rosterSync, saveRankRoles } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function SyncForms() {
  const [state, action] = useActionState<FormState, FormData>(rosterSync, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="mode" value="sync" />
        <p className="text-muted-foreground">
          Gives new members the next free callsign (600s, then 700s), releases callsigns of people who left, and fixes
          nicknames to <code>600 | Name</code>.
        </p>
        <SubmitButton className="btn btn-navy" pendingText="Syncing… this can take a minute">Sync now</SubmitButton>
      </form>
      <form action={action} className="space-y-2 border-t border-border pt-4">
        <input type="hidden" name="mode" value="reissue" />
        <p className="text-muted-foreground">
          <strong className="text-destructive">Re-issue all callsigns:</strong> wipes every callsign and numbers everyone
          again from 600 in chain-of-command order, then updates all nicknames. Type <code>REISSUE</code> to confirm.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input name="confirm" className="field max-w-48" placeholder="REISSUE" autoComplete="off" />
          <SubmitButton className="btn btn-danger" pendingText="Re-issuing… this can take a minute">
            Re-issue all callsigns
          </SubmitButton>
        </div>
      </form>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </div>
  );
}

export function RankRolesForm({ roles, usingAuto }: { roles: { id: string; name: string; checked: boolean }[]; usingAuto: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveRankRoles, {});
  return (
    <form action={action} className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Currently: <strong>{usingAuto ? "detected from role names" : "picked manually"}</strong>
      </div>
      <div className="grid max-h-96 gap-1 overflow-y-auto rounded-sm border border-border p-3 sm:grid-cols-2">
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="rank" value={r.id} defaultChecked={r.checked} className="h-4 w-4" />
            {r.name}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton className="btn btn-navy !py-2" pendingText="Saving…">Save picked ranks</SubmitButton>
        <button name="mode" value="auto" className="btn btn-outline !py-2">Go back to auto-detect</button>
      </div>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
