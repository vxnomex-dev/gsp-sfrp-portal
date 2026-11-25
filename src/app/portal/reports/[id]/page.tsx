import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FilePlus2, Scale } from "lucide-react";
import { casesForReport, iaRef } from "@/lib/ia";
import { guard } from "../../guard";
import { getReport } from "@/lib/data";
import { reportRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import { CaseForm } from "./CaseForm";

export default function ReportPage({ params }: PageProps<"/portal/reports/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <ReportDetail params={params} />
    </Suspense>
  );
}

function linkify(text: string) {
  return text.split(/(\s+)/).map((part, i) =>
    /^https?:\/\/\S+$/.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="break-all text-navy underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

async function ReportDetail({ params }: { params: PageProps<"/portal/reports/[id]">["params"] }) {
  const { id } = await params;
  const g = await guard("reports", `/portal/reports/${id}`);
  if (!g.viewer) return g.denied;

  const r = Number.isInteger(Number(id)) ? await getReport(Number(id)) : null;
  if (!r) return <p className="text-muted-foreground">Report not found.</p>;
  const iaCases = g.viewer.can("ia") ? await casesForReport(r.id) : [];

  return (
    <div>
      <Link href="/portal/reports" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> All reports
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="card card-gold p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold uppercase text-navy-ink">{reportRef(r.id)}</h2>
              <StatusBadge kind="report" status={r.status} />
            </div>
            <div className="mt-1 text-muted-foreground">Filed {fmtDate(r.created_at)}</div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg uppercase text-navy">Subject trooper</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div><dt className="field-label !mb-0.5">Name</dt><dd>{r.trooper_name}</dd></div>
              <div><dt className="field-label !mb-0.5">Callsign / badge / Roblox</dt><dd>{r.trooper_identifier || "—"}</dd></div>
              <div><dt className="field-label !mb-0.5">Category</dt><dd>{r.category}</dd></div>
              <div><dt className="field-label !mb-0.5">Date of incident</dt><dd>{r.incident_date}</dd></div>
              <div className="sm:col-span-2"><dt className="field-label !mb-0.5">Location</dt><dd>{r.location || "—"}</dd></div>
            </dl>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg uppercase text-navy">Complainant statement</h3>
            <p className="mt-2 whitespace-pre-wrap">{r.description}</p>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg uppercase text-navy">Evidence</h3>
            <p className="mt-2 whitespace-pre-wrap">{r.evidence ? linkify(r.evidence) : <em className="text-muted-foreground">None provided</em>}</p>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg uppercase text-navy">Complainant</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <div><dt className="field-label !mb-0.5">Discord</dt><dd>@{r.reporter_username}</dd></div>
              <div><dt className="field-label !mb-0.5">Discord ID</dt><dd className="break-all">{r.reporter_discord_id}</dd></div>
              <div><dt className="field-label !mb-0.5">Roblox</dt><dd>{r.reporter_roblox}</dd></div>
            </dl>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-48 lg:self-start">
          {g.viewer.can("ia") && (
            <div className="card card-gold space-y-3 p-5">
              <div className="flex items-center gap-2 font-display uppercase tracking-wide text-navy">
                <Scale size={18} /> Internal Affairs
              </div>
              {iaCases.length > 0 ? (
                <>
                  {iaCases.map((c) => (
                    <Link key={c.id} href={`/portal/ia/cases/${c.id}`} className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 py-2 hover:border-navy">
                      <span className="font-display text-navy">{iaRef(c.id)}</span>
                      <StatusBadge kind="ia" status={c.finding} />
                    </Link>
                  ))}
                  <p className="text-xs text-muted-foreground">This report&apos;s status follows the IA case.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Apply this report to an IA case. The reporter, reason, statement and evidence are filled in for you.
                  </p>
                  <Link href={`/portal/ia/new?report=${r.id}`} className="btn btn-navy w-full">
                    <FilePlus2 size={16} /> Open IA case
                  </Link>
                </>
              )}
            </div>
          )}
          <CaseForm id={r.id} status={r.status} notes={r.psb_notes ?? ""} assigned={!r.investigator_id ? "none" : r.investigator_id === g.viewer.uid ? "me" : "other"} />
          <p className="text-sm text-muted-foreground">
            Investigator: <strong>{r.investigator_name ?? "Unassigned"}</strong>
            {r.updated_at && <> · updated {fmtDate(r.updated_at)}</>}
          </p>
          {r.webhook_ok === false && <p className="text-sm text-destructive">The Discord notification for this report failed to send.</p>}
        </aside>
      </div>
    </div>
  );
}
