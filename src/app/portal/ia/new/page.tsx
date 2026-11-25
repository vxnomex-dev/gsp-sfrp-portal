import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../../guard";
import { currentEmployees, guessEmployee } from "@/lib/ia";
import { getReport } from "@/lib/data";
import { reportRef } from "@/lib/forms";
import { CaseEditor } from "../CaseEditor";

export default function NewCasePage({ searchParams }: PageProps<"/portal/ia/new">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <NewCase searchParams={searchParams} />
    </Suspense>
  );
}

async function NewCase({ searchParams }: { searchParams: PageProps<"/portal/ia/new">["searchParams"] }) {
  const g = await guard("ia", "/portal/ia/new");
  if (!g.viewer) return g.denied;
  const sp = await searchParams;
  const employees = await currentEmployees();
  const report = Number(sp.report) > 0 ? await getReport(Number(sp.report)) : null;

  const initial: Record<string, string> = { finding: "investigating", outcome: "Pending" };
  if (typeof sp.employee === "string" && employees.some((e) => e.id === sp.employee)) initial.subject_id = sp.employee;
  if (report) {
    const guess = guessEmployee(employees, report);
    Object.assign(initial, {
      report_id: String(report.id),
      subject_id: guess?.id ?? "",
      reporter_username: report.reporter_username,
      reporter_discord_id: report.reporter_discord_id,
      reporter_roblox: report.reporter_roblox,
      incident_date: report.incident_date,
      location: report.location ?? "",
      category: report.category,
      reason: `${report.category} — reported by @${report.reporter_username}`,
      complainant_statement: report.description,
      evidence: report.evidence ?? "",
    });
  }

  return (
    <div>
      <Link href="/portal/ia" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> Internal Affairs
      </Link>
      <h2 className="text-3xl font-semibold uppercase text-navy-ink">New Internal Affairs case</h2>
      {report ? (
        <p className="mt-1 text-muted-foreground">
          Opened from{" "}
          <Link href={`/portal/reports/${report.id}`} className="text-navy underline">
            {reportRef(report.id)}
          </Link>
          {" "}about <strong>{report.trooper_name}</strong>
          {report.trooper_identifier ? ` (${report.trooper_identifier})` : ""}. Check the employee is right — it was matched from what the reporter typed.
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">For internal referrals or anything that didn&apos;t come in through Report a Trooper.</p>
      )}
      <div className="mt-6">
        <CaseEditor employees={employees.map((e) => ({ id: e.id, label: e.label }))} initial={initial} reportLabel={report ? reportRef(report.id) : undefined} />
      </div>
    </div>
  );
}
