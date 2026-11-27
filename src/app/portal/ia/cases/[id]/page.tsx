import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FolderOpen, FileWarning, Trash2 } from "lucide-react";
import { guard } from "../../../guard";
import { attachmentsOf, currentEmployees, getCase, iaRef } from "@/lib/ia";
import { reportRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import { CaseEditor } from "../../CaseEditor";
import { deleteIaCase } from "../../actions";
import { Alert } from "@/components/ui";

export default function CasePage({ params, searchParams }: PageProps<"/portal/ia/cases/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <CaseDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CaseDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/portal/ia/cases/[id]">["params"];
  searchParams: PageProps<"/portal/ia/cases/[id]">["searchParams"];
}) {
  const { id } = await params;
  const g = await guard("ia", `/portal/ia/cases/${id}`);
  if (!g.viewer) return g.denied;
  const [c, employees, sp] = await Promise.all([getCase(Number(id)), currentEmployees(), searchParams]);
  if (!c) return <p className="text-muted-foreground">Case not found.</p>;

  // Keep the case's employee selectable even if they've left the roster
  const options = employees.map((e) => ({ id: e.id, label: e.label }));
  if (!employees.some((e) => e.id === c.subject_id)) {
    options.unshift({ id: c.subject_id, label: `${[c.subject_callsign, c.subject_name].filter(Boolean).join(" | ")} — no longer on the roster` });
  }
  const initial: Record<string, string> = Object.fromEntries(
    Object.entries(c)
      .filter(([k]) => k !== "attachments")
      .map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]),
  );

  return (
    <div>
      <Link href="/portal/ia" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Internal Affairs
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div className="card card-gold p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold uppercase text-navy-ink">{iaRef(c.id)}</h2>
              <StatusBadge kind="ia" status={c.finding} />
              <span className="rounded-sm bg-panel px-2 py-0.5 font-display text-xs uppercase tracking-wider text-navy">{c.outcome}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {[c.subject_callsign, c.subject_name].filter(Boolean).join(" | ")}
              {c.subject_rank ? ` — ${c.subject_rank}` : ""} · {c.reason}
            </p>
          </div>
          {sp.created && <Alert tone="success">Case opened and added to {c.subject_name}&apos;s employee file.</Alert>}
          <CaseEditor employees={options} initial={initial} caseId={c.id} attachments={attachmentsOf(c)} reportLabel={c.report_id ? reportRef(c.report_id) : undefined} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-48 lg:self-start">
          <div className="card space-y-3 p-5 text-sm">
            <Link href={`/portal/ia/employees/${c.subject_id}`} className="btn btn-navy w-full">
              <FolderOpen size={16} /> Employee file
            </Link>
            {c.report_id && (
              <Link href={`/portal/reports/${c.report_id}`} className="btn btn-outline w-full">
                <FileWarning size={16} /> {reportRef(c.report_id)}
              </Link>
            )}
            <dl className="space-y-2 pt-2">
              <div><dt className="field-label !mb-0">Investigator</dt><dd>{c.investigator_name}</dd></div>
              <div><dt className="field-label !mb-0">Opened</dt><dd>{fmtDate(c.created_at)}</dd></div>
              {c.updated_at && <div><dt className="field-label !mb-0">Last updated</dt><dd>{fmtDate(c.updated_at)}</dd></div>}
              {c.closed_at && <div><dt className="field-label !mb-0">Closed</dt><dd>{fmtDate(c.closed_at)}</dd></div>}
            </dl>
            {c.report_id && (
              <p className="text-xs text-muted-foreground">The linked report&apos;s status follows this case&apos;s finding.</p>
            )}
          </div>
          <details className="card p-5 text-sm">
            <summary className="cursor-pointer font-display uppercase tracking-wide text-destructive">Delete case</summary>
            <form action={deleteIaCase} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <p className="text-muted-foreground">This removes the case from the employee file for good. Type DELETE to confirm.</p>
              <input name="confirm" className="field" placeholder="DELETE" />
              <button className="btn btn-danger w-full !py-2">
                <Trash2 size={14} /> Delete {iaRef(c.id)}
              </button>
            </form>
          </details>
        </aside>
      </div>
    </div>
  );
}
