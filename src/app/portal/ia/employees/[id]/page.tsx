import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FilePlus2, UserRound } from "lucide-react";
import { guard } from "../../../guard";
import { employeeFile, iaRef, FINDINGS, type IaCase } from "@/lib/ia";
import { reportRef } from "@/lib/forms";
import { fetchGuildRoles } from "@/lib/discord-bot";
import { fmtCallsign } from "@/lib/callsign";
import { StatusBadge } from "@/components/StatusBadge";
import { Linkify } from "@/components/Linkify";
import { fmtDate } from "@/lib/format";
import { PrintButton } from "../../PrintButton";

export default function EmployeeFilePage({ params }: PageProps<"/portal/ia/employees/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <FileView params={params} />
    </Suspense>
  );
}

const KIND_LABELS: Record<string, string> = {
  termination: "Termination",
  strike: "Strike",
  warning: "Warning",
  inactivity: "Inactivity Notice",
  suspension: "Suspension",
  demotion: "Demotion",
  blacklist: "Blacklist",
};

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="field-label !mb-0.5">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}
const orNone = (v: string | null | undefined) => (v ? v : <em className="text-muted-foreground">None</em>);

function CaseCard({ c }: { c: IaCase }) {
  return (
    <article className="card break-inside-avoid p-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <Link href={`/portal/ia/cases/${c.id}`} className="font-display text-xl uppercase text-navy hover:underline">
          {iaRef(c.id)}
        </Link>
        <StatusBadge kind="ia" status={c.finding} />
        <span className="rounded-sm bg-panel px-2 py-0.5 font-display text-xs uppercase tracking-wider text-navy">{c.outcome}</span>
        <span className="ml-auto text-sm text-muted-foreground">
          Opened {fmtDate(c.created_at)}
          {c.closed_at && ` · closed ${fmtDate(c.closed_at)}`}
        </span>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Allegation" wide>{c.reason}</Field>
        <Field label="Category">{orNone(c.category)}</Field>
        <Field label="Incident">{[c.incident_date, c.location].filter(Boolean).join(" · ") || orNone(null)}</Field>
        <Field label="Reporter">
          {c.reporter_username ? `@${c.reporter_username}` : orNone(null)}
          {c.reporter_roblox && ` · Roblox: ${c.reporter_roblox}`}
          {c.reporter_discord_id && <span className="block text-xs text-muted-foreground">ID {c.reporter_discord_id}</span>}
        </Field>
        <Field label="Linked report">
          {c.report_id ? (
            <Link href={`/portal/reports/${c.report_id}`} className="text-navy underline">
              {reportRef(c.report_id)}
            </Link>
          ) : (
            orNone(null)
          )}
        </Field>
        <Field label="Reporter's statement" wide>{orNone(c.complainant_statement)}</Field>
        <Field label="Trooper's statement" wide>{orNone(c.trooper_statement)}</Field>
        {c.witness_statements && <Field label="Witness statements" wide>{c.witness_statements}</Field>}
        <Field label="Evidence" wide>{c.evidence ? <Linkify text={c.evidence} /> : orNone(null)}</Field>
        <Field label="Craig recording" wide>
          {c.recording_url ? (
            <a href={c.recording_url} target="_blank" rel="noreferrer noopener" className="break-all text-navy underline">
              {c.recording_url}
            </a>
          ) : (
            orNone(null)
          )}
        </Field>
        <Field label="Outcome">{c.outcome}{c.outcome_details ? ` — ${c.outcome_details}` : ""}</Field>
        <Field label="Investigator">{c.investigator_name}</Field>
        {c.investigator_notes && <Field label="Investigator notes" wide>{c.investigator_notes}</Field>}
      </dl>
    </article>
  );
}

async function FileView({ params }: { params: PageProps<"/portal/ia/employees/[id]">["params"] }) {
  const { id } = await params;
  const g = await guard("ia", `/portal/ia/employees/${id}`);
  if (!g.viewer) return g.denied;
  if (!/^\d{5,25}$/.test(id)) return <p className="text-muted-foreground">File not found.</p>;

  const [file, roles] = await Promise.all([employeeFile(id), fetchGuildRoles().catch(() => [])]);
  const roleName = new Map(roles.map((r) => [r.id, r.name.replace(/^\s*(FHP|GSP)\s*[|│:\-–—]\s*/i, "")]));
  const { current, cases, infractions, promotions } = file;
  const name = file.name ?? "Unknown employee";
  const sustained = cases.filter((c) => c.finding === "sustained").length;
  const openCases = cases.filter((c) => c.finding === "open" || c.finding === "investigating").length;
  const activeInfractions = infractions.filter((i) => i.status !== "voided").length;

  return (
    <div>
      <Link href="/portal/ia?view=files" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy print:hidden">
        <ChevronLeft size={16} /> Employee files
      </Link>

      <div className="card card-gold flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel text-navy">
          <UserRound size={32} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">Internal Affairs · Employee file</div>
          <h2 className="text-3xl font-semibold uppercase text-navy-ink">{name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {current ? (
              <span className="rounded-sm bg-[oklch(93%_0.06_155)] px-2 py-0.5 font-display uppercase tracking-wide text-[oklch(38%_0.11_155)]">
                Active · {[current.callsign, current.rank].filter(Boolean).join(" · ")}
              </span>
            ) : (
              <span className="rounded-sm bg-muted px-2 py-0.5 font-display uppercase tracking-wide text-muted-foreground">
                No longer in the department
              </span>
            )}
            <span className="text-muted-foreground">Discord ID {id}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton />
          <Link href={`/portal/ia/new${current ? `?employee=${id}` : ""}`} className="btn btn-navy">
            <FilePlus2 size={16} /> Open a case
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { n: cases.length, label: "IA cases" },
          { n: openCases, label: "Open" },
          { n: sustained, label: FINDINGS.sustained.label },
          { n: activeInfractions, label: "Active infractions" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="font-display text-3xl text-navy-ink">{s.n}</div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h3 className="mb-3 border-b-[3px] border-gold pb-2 font-display text-2xl uppercase text-navy-ink">Internal Affairs cases</h3>
        {cases.length === 0 ? (
          <div className="card p-6 text-muted-foreground">No IA cases on file.</div>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 border-b-[3px] border-gold pb-2 font-display text-2xl uppercase text-navy-ink">Infractions</h3>
        {infractions.length === 0 ? (
          <div className="card p-6 text-muted-foreground">No infractions on record.</div>
        ) : (
          <div className="card divide-y divide-border">
            {infractions.map((i) => (
              <div key={i.id} className={`flex flex-wrap gap-x-4 gap-y-1 px-5 py-4 ${i.status === "voided" ? "opacity-60" : ""}`}>
                <div className="w-28 shrink-0 font-display uppercase text-navy-ink">{KIND_LABELS[i.kind] ?? i.kind}</div>
                <div className="min-w-0 flex-1">
                  <div>
                    {i.policy && <strong>{i.policy}: </strong>}
                    {i.reason}
                    {i.duration && <span className="text-muted-foreground"> ({i.duration})</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Case #{i.id} · issued by {i.issuer_name} · {fmtDate(i.created_at)}
                    {i.status === "voided" && ` · VOIDED${i.void_reason ? ` — ${i.void_reason}` : ""}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 border-b-[3px] border-gold pb-2 font-display text-2xl uppercase text-navy-ink">Promotions</h3>
        {promotions.length === 0 ? (
          <div className="card p-6 text-muted-foreground">No promotions on record.</div>
        ) : (
          <div className="card divide-y divide-border">
            {promotions.map((p) => (
              <div key={p.id} className="px-5 py-4">
                <div className="font-semibold text-navy-ink">
                  {roleName.get(p.old_role_id) ?? "Previous rank"} → {roleName.get(p.new_role_id) ?? "New rank"}
                  {p.new_callsign !== null && <span className="text-muted-foreground"> · {fmtCallsign(p.new_callsign)}</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {p.reason} · by {p.issuer_name} · {fmtDate(p.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
