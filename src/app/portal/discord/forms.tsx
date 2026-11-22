"use client";

import { useActionState, useState } from "react";
import { chooseServer, leaveServer, saveDiscordSetup } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

export function ServerPicker({
  guild,
  current,
  fallbackIcon,
}: {
  guild: { id: string; name: string; icon: string | null };
  current: boolean;
  fallbackIcon: React.ReactNode;
}) {
  const [chooseState, chooseAct] = useActionState<FormState, FormData>(chooseServer, {});
  const [leaveState, leaveAction] = useActionState<FormState, FormData>(leaveServer, {});
  const [leaving, setLeaving] = useState(false);
  const message = leaveState.message ?? chooseState.message;
  const ok = leaveState.message ? leaveState.ok : chooseState.ok;

  return (
    <div className={`space-y-3 px-4 py-3 ${current ? "bg-panel" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        {guild.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guild.icon} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card">{fallbackIcon}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-navy-ink">{guild.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{guild.id}</div>
        </div>
        {current ? (
          <span className="rounded-sm bg-navy px-2 py-1 font-display text-xs uppercase tracking-wider text-white">In use</span>
        ) : (
          <form action={chooseAct}>
            <input type="hidden" name="guild" value={guild.id} />
            <SubmitButton className="btn btn-navy !px-3 !py-1.5 text-xs" pendingText="Switching…">
              Use this server
            </SubmitButton>
          </form>
        )}
        <button type="button" onClick={() => setLeaving((v) => !v)} className="btn btn-outline !px-3 !py-1.5 text-xs">
          Leave server
        </button>
      </div>
      {leaving && (
        <form action={leaveAction} className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
          <input type="hidden" name="guild" value={guild.id} />
          <span className="text-muted-foreground">
            The bot will leave <strong>{guild.name}</strong>. Type <code>LEAVE</code> to confirm:
          </span>
          <input name="confirm" className="field max-w-32 !py-1.5" placeholder="LEAVE" autoComplete="off" />
          <SubmitButton className="btn btn-danger !px-3 !py-1.5 text-xs" pendingText="Leaving…">
            Leave
          </SubmitButton>
        </form>
      )}
      {message && <Alert tone={ok ? "success" : "error"}>{message}</Alert>}
    </div>
  );
}

type Slot = { key: string; label: string; hint: string; category?: boolean };

export function SetupForm({
  roleSlots,
  channelSlots,
  roles,
  channels,
  values,
}: {
  roleSlots: Slot[];
  channelSlots: Slot[];
  roles: { id: string; name: string }[];
  channels: { id: string; name: string; category: boolean; parent: string }[];
  values: { roles: Record<string, string>; channels: Record<string, string> };
}) {
  const [state, action] = useActionState<FormState, FormData>(saveDiscordSetup, {});
  const row = "grid gap-1 py-3 sm:grid-cols-[16rem_1fr] sm:items-center sm:gap-4";
  return (
    <form action={action} className="space-y-6">
      <div>
        <div className="field-label">Roles</div>
        <div className="divide-y divide-border">
          {roleSlots.map((s) => (
            <label key={s.key} className={row}>
              <span>
                <span className="block font-semibold text-navy-ink">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
              <select name={`role_${s.key}`} defaultValue={values.roles[s.key] ?? ""} className="field">
                <option value="">— Not set —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="field-label">Channels</div>
        <div className="divide-y divide-border">
          {channelSlots.map((s) => (
            <label key={s.key} className={row}>
              <span>
                <span className="block font-semibold text-navy-ink">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
              <select name={`channel_${s.key}`} defaultValue={values.channels[s.key] ?? ""} className="field">
                <option value="">— Not set —</option>
                {channels
                  .filter((c) => c.category === !!s.category)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category ? c.name : `#${c.name}${c.parent ? `  (${c.parent})` : ""}`}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Saving…">
          Save roles &amp; channels
        </SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
