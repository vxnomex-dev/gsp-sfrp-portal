import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { buildRoster, getLastSync, getRankRoleSetting, isRankRole } from "@/lib/roster";
import { fmtDate } from "@/lib/format";
import { RankRolesForm, SyncForms } from "./forms";

export const maxDuration = 300;

export default function RosterSettingsPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <RosterSettings />
    </Suspense>
  );
}

async function RosterSettings() {
  const g = await guard("content", "/portal/roster");
  if (!g.viewer) return g.denied;

  let roles: { id: string; name: string; position: number }[] = [];
  let error: string | null = null;
  try {
    roles = (await buildRoster()).roles.filter((r) => r.name !== "@everyone");
  } catch (e) {
    error = (e as Error).message;
  }
  const picked = await getRankRoleSetting();
  const last = await getLastSync();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Roster &amp; Callsigns</h2>
        <p className="mt-1 text-muted-foreground">
          The <Link className="text-navy underline" href="/roster">public roster</Link> reads the Discord server live and
          syncs callsigns + nicknames automatically every 10 minutes.
        </p>
      </div>

      {error && (
        <div className="border-l-4 border-destructive bg-card px-5 py-4 text-sm">
          Couldn&apos;t read the server: {error}. Make sure the bot token is set and <strong>Server Members Intent</strong> is on.
        </div>
      )}

      <div className="card card-gold space-y-4 p-6">
        <h3 className="font-display text-xl uppercase text-navy-ink">Sync</h3>
        <SyncForms />
        {last && (
          <div className="border-t border-border pt-4 text-sm">
            <div className="text-muted-foreground">
              Last {last.reissued ? "re-issue" : "sync"}: {fmtDate(last.at)} — {last.members} members, {last.newCallsigns} new
              callsigns, {last.nicknamesUpdated} nicknames updated.
            </div>
            {last.failures.length > 0 && (
              <div className="mt-3">
                <div className="field-label">Couldn&apos;t rename</div>
                <ul className="list-disc space-y-1 pl-5">
                  {last.failures.map((f) => (
                    <li key={f.name}>
                      <strong>{f.name}</strong> — <span className="text-muted-foreground">{f.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-4 p-6">
        <h3 className="font-display text-xl uppercase text-navy-ink">Rank roles</h3>
        <p className="text-muted-foreground">
          Ranks decide the order within each section. By default any role with a rank word in its name (Colonel, Major,
          Captain, Lieutenant, Sergeant, Corporal, Trooper, Cadet…) counts. Tick roles below to choose them yourself.
          Higher in Discord = higher in the roster.
        </p>
        {roles.length > 0 && (
          <RankRolesForm
            usingAuto={!picked}
            roles={roles.map((r) => ({ id: r.id, name: r.name, checked: isRankRole(r as never, picked) }))}
          />
        )}
      </div>
    </div>
  );
}
