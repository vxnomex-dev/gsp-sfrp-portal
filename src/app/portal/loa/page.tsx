import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { fmtDate } from "@/lib/format";
import { endExpiredLoas, isoDay, listLoas, loaDays, type Loa } from "@/lib/loa";
import { managerScope } from "@/lib/shifts";
import { buildRoster } from "@/lib/roster";
import { endLoaWeb } from "@/app/actions";
import { DecideButtons, LoaForm } from "./forms";

export const metadata = { title: "Leave of Absence" };

export default function LoaPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <LoaContent />
    </Suspense>
  );
}

const day = (d: string | Date) =>
  new Date(`${isoDay(d)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const badge: Record<Loa["status"], string> = {
  pending: "bg-gold/25 text-navy-ink border-gold/60",
  approved: "bg-success/15 text-success border-success/40",
  denied: "bg-destructive/10 text-destructive border-destructive/40",
  ended: "bg-panel text-muted-foreground border-border",
};

function Status({ s }: { s: Loa["status"] }) {
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 font-display text-xs uppercase tracking-wider ${badge[s]}`}>{s}</span>
  );
}

async function LoaContent() {
  const g = await guard("portal", "/portal/loa");
  if (!g.viewer) return g.denied;
  const viewer = g.viewer;
  await endExpiredLoas().catch(() => {});
  const [mine, scope] = await Promise.all([listLoas({ userId: viewer.uid }), managerScope(viewer)]);
  let all: (Loa & { canManage: boolean })[] = [];
  if (scope) {
    const [rows, roster] = await Promise.all([listLoas({ limit: 100 }), buildRoster().catch(() => ({ entries: [] }))]);
    const rankOf = new Map(roster.entries.map((e) => [e.userId, e.rank]));
    all = rows.map((l) => ({ ...l, canManage: scope.canManage({ userId: l.user_id, rank: rankOf.get(l.user_id) ?? null }) }));
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Leave of Absence</h2>
        <p className="mt-1 text-muted-foreground">
          Request time away from the department. Supervisors approve or deny it in Discord or here, and you&apos;ll get a DM.
          You can also use <code>/loa</code> in Discord.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="card card-gold p-6">
          <h3 className="mb-4 font-display text-xl uppercase text-navy-ink">New request</h3>
          <LoaForm today={today} />
        </div>
        <div className="card p-6">
          <h3 className="mb-3 font-display text-xl uppercase text-navy-ink">My requests</h3>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t requested any leave.</p>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-navy-ink">
                      {day(l.start_date)} – {day(l.end_date)}{" "}
                      <span className="font-normal text-muted-foreground">({loaDays(l)}d)</span>
                    </div>
                    {l.decision_reason && <div className="text-sm text-muted-foreground">Reason: {l.decision_reason}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Status s={l.status} />
                    {(l.status === "pending" || l.status === "approved") && (
                      <form action={endLoaWeb}>
                        <input type="hidden" name="id" value={l.id} />
                        <button className="btn btn-outline !px-2.5 !py-1 text-xs">
                          {l.status === "pending" ? "Cancel" : "I'm back"}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {scope && (
        <div className="space-y-3">
          <h3 className="font-display text-2xl uppercase text-navy-ink">All requests</h3>
          {all.length === 0 ? (
            <div className="card p-6 text-muted-foreground">No leave requests yet.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-border bg-panel font-display text-xs uppercase tracking-wider text-navy">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((l) => (
                    <tr key={l.id} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-navy-ink">{l.user_name}</div>
                        <div className="text-xs text-muted-foreground">Sent {fmtDate(l.created_at)}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {day(l.start_date)} – {day(l.end_date)}
                        <div className="text-xs text-muted-foreground">{loaDays(l)} days</div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted-foreground">{l.reason}</td>
                      <td className="px-4 py-3">
                        <Status s={l.status} />
                        {l.decided_by_name && <div className="mt-1 text-xs text-muted-foreground">by {l.decided_by_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {!l.canManage ? (
                          <span className="block text-right text-xs text-muted-foreground">—</span>
                        ) : l.status === "pending" ? (
                          <DecideButtons id={l.id} />
                        ) : l.status === "approved" ? (
                          <form action={endLoaWeb} className="flex justify-end">
                            <input type="hidden" name="id" value={l.id} />
                            <button className="btn btn-outline !px-2.5 !py-1 text-xs">End leave</button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
