"use client";

import { useActionState } from "react";
import { rosterSync } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function SyncForms() {
  const [state, action] = useActionState<FormState, FormData>(rosterSync, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="mode" value="sync" />
        <p className="text-muted-foreground">
          Gives anyone whose callsign doesn&apos;t match their rank the lowest free number in their rank&apos;s block, releases
          callsigns of people who left, and fixes nicknames to <code>630 | Name</code>.
        </p>
        <SubmitButton className="btn btn-navy" pendingText="Syncing… this can take a minute">Sync now</SubmitButton>
      </form>
      <form action={action} className="space-y-2 border-t border-border pt-4">
        <input type="hidden" name="mode" value="reissue" />
        <p className="text-muted-foreground">
          <strong className="text-destructive">Re-issue all callsigns:</strong> wipes every callsign and numbers everyone
          fresh within their rank&apos;s block, then updates all nicknames. Type <code>REISSUE</code> to confirm.
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
