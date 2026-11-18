"use client";

import { useActionState } from "react";
import { registerDiscordCommands } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function RegisterCommands() {
  const [state, action] = useActionState<FormState, FormData>(() => registerDiscordCommands(), {});
  return (
    <form action={action} className="space-y-3">
      <SubmitButton className="btn btn-navy" pendingText="Registering…">Register slash commands</SubmitButton>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
