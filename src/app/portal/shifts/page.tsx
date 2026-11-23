import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Clock, Timer, Users } from "lucide-react";
import { guard } from "../guard";
import { fmtDate } from "@/lib/format";
import { activeShift, completedSeconds, fmtDuration, managerScope, recentShifts, rosterWithShifts } from "@/lib/shifts";
import { endExpiredLoas } from "@/lib/loa";
import { managerEndShift } from "@/app/actions";
import { LiveTimer, ShiftToggle, WipeAllForm, WipeOneButton } from "./forms";

export const metadata = { title: "Shifts" };

export default function ShiftsPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <Shifts />
    </Suspense>
  );
}

async function Shifts() {
  const g = await guard("portal", "/portal/shifts");
  if (!g.viewer) return g.denied;
  const viewer = g.viewer;
  await endExpiredLoas().catch(() => {});

  const [active, done, recent, scope] = await Promise.all([
    activeShift(viewer.uid),
    completedSeconds(viewer.uid),
    recentShifts(viewer.uid, 8),
    managerScope(viewer),
  ]);
  const board = scope ? await rosterWithShifts().catch(() => []) : [];
  const onDuty = board.filter((m) => m.activeSince);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Shifts</h2>
        <p className="mt-1 text-muted-foreground">
          Go on and off duty here or with <code>/shift start</code> and <code>/shift end</code> in Discord.
        </p>
      </div>

      {/* My shift */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className={`card card-gold p-6 ${active ? "ring-2 ring-success/40" : ""}`}>
          <div className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
            <Timer size={16} className="text-navy" /> My shift
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className={`font-display text-3xl uppercase ${active ? "text-success" : "text-navy-ink"}`}>
                {active ? "On duty" : "Off duty"}
              </div>
              {active ? (
                <div className="mt-1 text-muted-foreground">
                  Since {fmtDate(active.started_at)} ·{" "}
                  <LiveTimer since={new Date(active.started_at).toISOString()} className="font-semibold text-navy-ink" />
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">Start a shift when you load into the server.</div>
              )}
            </div>
            <ShiftToggle onDuty={!!active} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
            <div>
              <div className="font-display text-2xl text-navy-ink">
                {active ? <LiveTimer since={new Date(active.started_at).toISOString()} base={done} /> : fmtDuration(done)}
              </div>
              <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">Total since last wipe</div>
            </div>
            <div>
              <div className="font-display text-2xl text-navy-ink">{recent.length}</div>
              <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">Recent shifts</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
            <Clock size={16} className="text-navy" /> My recent shifts
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted-foreground">{fmtDate(s.started_at)}</span>
                  <span className="font-semibold text-navy-ink">
                    {s.ended_at ? (
                      fmtDuration((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
                    ) : (
                      <LiveTimer since={new Date(s.started_at).toISOString()} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Management */}
      {scope && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-2xl uppercase text-navy-ink">
                <Users size={22} className="text-navy" /> Department shifts
              </h3>
              <p className="text-sm text-muted-foreground">
                {onDuty.length} on duty now.{" "}
                {scope.isOotc
                  ? "As the Office of the Colonel you can manage everyone."
                  : "You can manage members ranked below you."}
              </p>
            </div>
            <WipeAllForm />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-border bg-panel font-display text-xs uppercase tracking-wider text-navy">
                <tr>
                  <th className="px-4 py-3">Callsign</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {board.map((m) => {
                  const can = scope.canManage(m);
                  return (
                    <tr key={m.userId} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-display tracking-wider text-navy-ink">{m.callsignLabel ?? "—"}</td>
                      <td className="px-4 py-2.5 font-semibold text-navy-ink">{m.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.rankLabel}</td>
                      <td className="px-4 py-2.5">
                        {m.activeSince ? (
                          <span className="inline-flex items-center gap-1.5 text-success">
                            <span className="h-2 w-2 rounded-full bg-success" /> On duty ·{" "}
                            <LiveTimer since={m.activeSince} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Off duty</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-navy-ink">
                        {m.activeSince ? <LiveTimer since={m.activeSince} base={m.completed} /> : fmtDuration(m.total)}
                      </td>
                      <td className="px-4 py-2.5">
                        {can ? (
                          <div className="flex justify-end gap-2">
                            {m.activeSince && (
                              <form action={managerEndShift}>
                                <input type="hidden" name="user" value={m.userId} />
                                <button className="btn btn-outline !px-2.5 !py-1 text-xs">End shift</button>
                              </form>
                            )}
                            {m.total > 0 && <WipeOneButton userId={m.userId} name={m.name} />}
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
