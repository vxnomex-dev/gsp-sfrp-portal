import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FilePlus2, FolderOpen, Lock, Search } from "lucide-react";
import { guard } from "../guard";
import { iaCounts, iaRef, listCases, reportsWithoutCase, employeeFiles, FINDINGS } from "@/lib/ia";
import { reportRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";

export default function IaPage({ searchParams }: PageProps<"/portal/ia">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const tabClass = (active: boolean) =>
  `rounded-sm border px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
    active ? "border-navy bg-navy text-white" : "border-border bg-card text-navy hover:border-navy"
  }`;

async function Dashboard({ searchParams }: { searchParams: PageProps<"/portal/ia">["searchParams"] }) {
  const g = await guard("ia", "/portal/ia");
  if (!g.viewer) return g.denied;
  const sp = await searchParams;
  const view = sp.view === "files" || sp.view === "reports" ? sp.view : "cases";
  const filter = (["active", "closed", "mine", "all"] as const).find((f) => f === sp.status) ?? "active";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const counts = await iaCounts();

  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Portal
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/divisions/ia.png" alt="" className="h-14 w-14 object-contain" />
          <div>
            <h2 className="text-3xl font-semibold uppercase text-navy-ink">Internal Affairs</h2>
            <p className="text-muted-foreground">Cases, incoming reports and employee files.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-navy px-2.5 py-1 font-display text-xs uppercase tracking-wider text-white">
            <Lock size={12} className="text-gold" /> IA confidential
          </span>
          <Link href="/portal/ia/new" className="btn btn-gold">
            <FilePlus2 size={16} /> New case
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
        <Link href="/portal/ia" className={tabClass(view === "cases")}>
          Cases {counts.open > 0 && <span className="ml-1 rounded-sm bg-gold px-1.5 text-gold-foreground">{counts.open}</span>}
        </Link>
        <Link href="/portal/ia?view=reports" className={tabClass(view === "reports")}>
          Incoming reports {counts.waiting > 0 && <span className="ml-1 rounded-sm bg-gold px-1.5 text-gold-foreground">{counts.waiting}</span>}
        </Link>
        <Link href="/portal/ia?view=files" className={tabClass(view === "files")}>
          Employee files
        </Link>
      </div>

      <div className="mt-6">
        {view === "cases" && <Cases filter={filter} viewerId={g.viewer.uid} />}
        {view === "reports" && <Incoming />}
        {view === "files" && <Files q={q} />}
      </div>
    </div>
  );
}

async function Cases({ filter, viewerId }: { filter: "active" | "closed" | "mine" | "all"; viewerId: string }) {
  const rows = await listCases(filter, viewerId);
  const tabs = [
    { key: "active", label: "Active" },
    { key: "mine", label: "My cases" },
    { key: "closed", label: "Closed" },
    { key: "all", label: "All" },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.key} href={`/portal/ia?status=${t.key}`} className={tabClass(filter === t.key)}>
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted-foreground">No cases here.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
            <thead className="border-b border-border bg-panel font-display text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Allegation</th>
                <th className="px-4 py-3">Finding</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Investigator</th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-panel/60">
                  <td className="px-4 py-3 font-display">
                    <Link href={`/portal/ia/cases/${c.id}`} className="text-navy hover:underline">
                      {iaRef(c.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/ia/employees/${c.subject_id}`} className="hover:underline">
                      {[c.subject_callsign, c.subject_name].filter(Boolean).join(" | ")}
                    </Link>
                  </td>
                  <td className="max-w-72 truncate px-4 py-3" title={c.reason}>
                    {c.reason}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="ia" status={c.finding} />
                  </td>
                  <td className="px-4 py-3">{c.outcome}</td>
                  <td className="px-4 py-3">{c.investigator_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function Incoming() {
  const rows = await reportsWithoutCase();
  if (!rows.length) return <div className="card p-8 text-center text-muted-foreground">Every open report already has an IA case.</div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Public reports that don&apos;t have an Internal Affairs case yet. Open a case to fill it in from the report.</p>
      {rows.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <div className="font-display text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {reportRef(r.id)} · {fmtDate(r.created_at)} · {r.category}
            </div>
            <div className="mt-0.5 font-semibold text-navy-ink">
              About {r.trooper_name}
              {r.trooper_identifier ? ` (${r.trooper_identifier})` : ""} — reported by @{r.reporter_username}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/portal/reports/${r.id}`} className="btn btn-outline !py-2">
              View report
            </Link>
            <Link href={`/portal/ia/new?report=${r.id}`} className="btn btn-navy !py-2">
              <FilePlus2 size={16} /> Open IA case
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

async function Files({ q }: { q: string }) {
  const all = await employeeFiles();
  const rows = q ? all.filter((f) => f.name?.toLowerCase().includes(q) || f.id.includes(q)) : all;
  return (
    <>
      <form className="mb-4 flex max-w-md gap-2" action="/portal/ia">
        <input type="hidden" name="view" value="files" />
        <input name="q" defaultValue={q} placeholder="Search by name or Discord ID" className="field" />
        <button className="btn btn-navy !px-4">
          <Search size={16} />
        </button>
      </form>
      <p className="mb-4 text-sm text-muted-foreground">
        Everyone with a case or an infraction on record. Files are kept even after someone is terminated or leaves.
      </p>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted-foreground">No files found.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <Link key={f.id} href={`/portal/ia/employees/${f.id}`} className="card group flex items-start gap-3 p-5 hover:border-navy">
              <FolderOpen className="mt-0.5 shrink-0 text-navy" size={22} />
              <div className="min-w-0">
                <div className="truncate font-display text-lg uppercase text-navy-ink group-hover:text-navy">{f.name}</div>
                <div className="text-sm text-muted-foreground">
                  {f.cases} case{f.cases === 1 ? "" : "s"}
                  {f.open > 0 && ` · ${f.open} open`}
                  {f.sustained > 0 && ` · ${f.sustained} ${FINDINGS.sustained.label.toLowerCase()}`} · {f.infractions} infraction
                  {f.infractions === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-muted-foreground">Last activity {fmtDate(f.last)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
