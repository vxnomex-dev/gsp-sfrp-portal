import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { listApplications } from "@/lib/data";
import { APPLICATION_STATUSES, appRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";

export default function ApplicationsPage({ searchParams }: PageProps<"/portal/applications">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <ApplicationsList searchParams={searchParams} />
    </Suspense>
  );
}

async function ApplicationsList({ searchParams }: { searchParams: PageProps<"/portal/applications">["searchParams"] }) {
  const g = await guard("applications", "/portal/applications");
  if (!g.viewer) return g.denied;

  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "active";
  const filter = raw in APPLICATION_STATUSES || raw === "all" ? raw : "active";
  const all = await listApplications();
  const rows =
    filter === "all" ? all : filter === "active" ? all.filter((a) => a.status === "pending" || a.status === "review") : all.filter((a) => a.status === filter);

  const tabs = [
    { key: "active", label: "Needs review" },
    ...Object.entries(APPLICATION_STATUSES).map(([key, s]) => ({ key, label: s.label })),
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Portal
      </Link>
      <h2 className="text-3xl font-semibold uppercase text-navy-ink">Cadet Applications</h2>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/applications?status=${t.key}`}
            className={`rounded-sm border px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
              filter === t.key ? "border-navy bg-navy text-white" : "border-border bg-card text-navy hover:border-navy"
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
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Roblox</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No applications here.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                <td className="px-4 py-3">
                  <Link href={`/portal/applications/${a.id}`} className="font-semibold text-navy hover:underline">
                    {appRef(a.id)}
                  </Link>
                </td>
                <td className="px-4 py-3">@{a.discord_username}</td>
                <td className="px-4 py-3">{a.roblox_username}</td>
                <td className="px-4 py-3">{a.age}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.created_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge kind="application" status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
