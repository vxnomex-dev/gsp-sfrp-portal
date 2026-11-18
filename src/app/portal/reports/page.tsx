import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Lock } from "lucide-react";
import { guard } from "../guard";
import { listReports } from "@/lib/data";
import { REPORT_STATUSES, reportRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";

export default function ReportsPage({ searchParams }: PageProps<"/portal/reports">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <ReportsList searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsList({ searchParams }: { searchParams: PageProps<"/portal/reports">["searchParams"] }) {
  const g = await guard("reports", "/portal/reports");
  if (!g.viewer) return g.denied;

  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "active";
  const filter = raw in REPORT_STATUSES || raw === "all" ? raw : "active";
  const all = await listReports();
  const rows =
    filter === "all" ? all : filter === "active" ? all.filter((r) => r.status === "open" || r.status === "investigating") : all.filter((r) => r.status === filter);

  const tabs = [
    { key: "active", label: "Active cases" },
    ...Object.entries(REPORT_STATUSES).map(([key, s]) => ({ key, label: s.label })),
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Portal
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Employee Reports</h2>
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-navy px-2.5 py-1 font-display text-xs uppercase tracking-wider text-white">
          <Lock size={12} className="text-gold" /> HR confidential
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/reports?status=${t.key}`}
            className={`rounded-sm border px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
              filter === t.key ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-navy"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-[0.95rem]">
          <thead className="border-b border-border bg-panel font-display text-xs uppercase tracking-wider text-navy">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Trooper</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Investigator</th>
              <th className="px-4 py-3">Filed</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No reports here.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                <td className="px-4 py-3">
                  <Link href={`/portal/reports/${r.id}`} className="font-semibold text-navy hover:underline">
                    {reportRef(r.id)}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.trooper_name}</td>
                <td className="px-4 py-3">{r.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.investigator_name ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge kind="report" status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
