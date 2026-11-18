import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { RANKS, SLOT_RANKS, buildRoster, getAssignments, getLastSync, type RosterEntry } from "@/lib/roster";
import { fmtDate } from "@/lib/format";
import { AssignmentsForm, SyncForms } from "./forms";

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

  let error: string | null = null;
  let detected = new Map<string, string[]>();
  let counts = new Map<string, number>();
  let entries: RosterEntry[] = [];
  try {
    const r = await buildRoster();
    detected = r.detected;
    entries = r.entries;
    counts = new Map(RANKS.map((k) => [k.key, r.entries.filter((e) => e.rank === k.key).length]));
  } catch (e) {
    error = (e as Error).message;
  }
  const [last, assignments] = await Promise.all([getLastSync(), getAssignments()]);

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
            {last.noSpot.length > 0 && (
              <div className="mt-3">
                <div className="field-label">No open spot</div>
                <ul className="list-disc space-y-1 pl-5">
                  {last.noSpot.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
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

      <div className="card card-gold space-y-4 p-6">
        <div>
          <h3 className="font-display text-xl uppercase text-navy-ink">Assignments</h3>
          <p className="mt-1 text-muted-foreground">
            Assignments belong to the <strong>position</strong>, not the person — if someone is promoted or leaves, the
            assignment stays with the callsign for whoever fills it next. They show in the Assignment column of the{" "}
            <Link className="text-navy underline" href="/roster">public roster</Link>. Leave a box empty for none.
          </p>
        </div>
        <AssignmentsForm
          slots={SLOT_RANKS.flatMap((r) =>
            Array.from({ length: r.block[1] - r.block[0] + 1 }, (_, i) => {
              const n = r.block[0] + i;
              return { callsign: n, rank: r.label, holder: entries.find((e) => e.rank === r.key && e.callsign === n)?.name ?? null };
            }),
          )}
          ranks={RANKS.filter((r) => !SLOT_RANKS.some((x) => x.key === r.key)).map((r) => ({
            key: r.key,
            label: r.label,
            callsigns: `${r.block[0]}–${r.block[1]}`,
          }))}
          values={assignments as { slots: Record<string, string>; ranks: Record<string, string> }}
        />
      </div>

      <div className="card space-y-4 p-6">
        <h3 className="font-display text-xl uppercase text-navy-ink">Callsign plan</h3>
        <p className="text-muted-foreground">
          Callsigns follow each member&apos;s <strong>rank role</strong>. Ranks are recognised from the Discord role name.
          If a rank shows &ldquo;not found&rdquo;, the role is named differently — tell the developer the exact name.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border font-display text-xs uppercase tracking-wider text-navy">
              <tr>
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Callsigns</th>
                <th className="py-2 pr-4">Spots</th>
                <th className="py-2 pr-4">Members</th>
                <th className="py-2">Discord role</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 font-semibold text-navy-ink">{r.label}</td>
                  <td className="py-2 pr-4">{r.block[0] === r.block[1] ? r.block[0] : `${r.block[0]}–${r.block[1]}`}</td>
                  <td className="py-2 pr-4">{r.block[1] - r.block[0] + 1}</td>
                  <td className="py-2 pr-4">{counts.get(r.key) ?? 0}</td>
                  <td className="py-2">
                    {detected.get(r.key)?.join(", ") ?? <span className="text-destructive">not found</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
