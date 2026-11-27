import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { listNdas, ndaRef } from "@/lib/nda";
import { fmtDate } from "@/lib/format";

export default function NdaListPage({ searchParams }: PageProps<"/portal/nda">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS = {
  pending: { label: "Waiting for countersignature", cls: "bg-gold/25 text-[oklch(40%_0.1_70)] border-gold/60" },
  countersigned: { label: "Complete", cls: "bg-[oklch(93%_0.06_155)] text-[oklch(38%_0.11_155)] border-[oklch(75%_0.1_155)]" },
  void: { label: "Void", cls: "bg-muted text-muted-foreground border-border" },
} as const;

async function List({ searchParams }: { searchParams: PageProps<"/portal/nda">["searchParams"] }) {
  const g = await guard("applications", "/portal/nda");
  if (!g.viewer) return g.denied;
  const sp = await searchParams;
  const filter = (["pending", "countersigned", "void", "all"] as const).find((f) => f === sp.status) ?? "pending";
  const rows = await listNdas(filter);
  const tabs = [
    { key: "pending", label: "Needs countersigning" },
    { key: "countersigned", label: "Complete" },
    { key: "void", label: "Void" },
    { key: "all", label: "All" },
  ];
  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Portal
      </Link>
      <h2 className="text-3xl font-semibold uppercase text-navy-ink">Confidentiality Agreements</h2>
      <p className="mt-1 text-muted-foreground">
        Invitees sign at <span className="font-semibold text-navy">fhpvcfsrp.site/nda</span>. Countersign them here as the Department Representative.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/nda?status=${t.key}`}
            className={`rounded-sm border px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
              filter === t.key ? "border-navy bg-navy text-white" : "border-border bg-card text-navy hover:border-navy"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card mt-5 p-8 text-center text-muted-foreground">Nothing here.</div>
      ) : (
        <div className="card mt-5 divide-y divide-border">
          {rows.map((n) => (
            <Link key={n.id} href={`/portal/nda/${n.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-panel/60">
              <div className="w-24 font-display text-navy">{ndaRef(n.id)}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy-ink">{n.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  @{n.username}
                  {n.roblox ? ` · Roblox ${n.roblox}` : ""} · signed {fmtDate(n.signed_at)}
                </div>
              </div>
              <span className={`rounded-sm border px-2 py-0.5 font-display text-xs uppercase tracking-wider ${STATUS[n.status].cls}`}>
                {STATUS[n.status].label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
