import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FolderOpen } from "lucide-react";
import { guard } from "../../guard";
import { getNda, ndaRef } from "@/lib/nda";
import { fmtDate } from "@/lib/format";
import { NdaDocument } from "@/components/NdaDocument";
import { PrintButton } from "../../ia/PrintButton";
import { CountersignForm } from "./CountersignForm";
import { voidNda } from "@/app/nda/actions";

export default function NdaDetailPage({ params }: PageProps<"/portal/nda/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <Detail params={params} />
    </Suspense>
  );
}

const day = (d: string | Date | null) => (d ? fmtDate(d).replace(/,\s*\d{1,2}:\d{2}.*$/, "") : null);

async function Detail({ params }: { params: PageProps<"/portal/nda/[id]">["params"] }) {
  const { id } = await params;
  const g = await guard("applications", `/portal/nda/${id}`);
  if (!g.viewer) return g.denied;
  const n = await getNda(Number(id));
  if (!n) return <p className="text-muted-foreground">Agreement not found.</p>;

  return (
    <div>
      <Link href="/portal/nda" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy print:hidden">
        <ChevronLeft size={16} /> Confidentiality Agreements
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <NdaDocument
          reference={ndaRef(n.id)}
          invitee={{ signature: n.signature, name: n.full_name, date: day(n.signed_at) }}
          rep={{ signature: n.rep_signature, name: n.rep_name, date: day(n.rep_signed_at) }}
        />
        <aside className="space-y-4 print:hidden lg:sticky lg:top-48 lg:self-start">
          <div className="card space-y-2 p-5 text-sm">
            <div><span className="field-label !mb-0">Invitee</span>{n.full_name}</div>
            <div><span className="field-label !mb-0">Discord</span>@{n.username} <span className="text-xs text-muted-foreground">({n.user_id})</span></div>
            {n.roblox && <div><span className="field-label !mb-0">Roblox</span>{n.roblox}</div>}
            <div><span className="field-label !mb-0">Signed</span>{fmtDate(n.signed_at)}</div>
            <div><span className="field-label !mb-0">Version</span>{n.version}</div>
            {n.status === "void" && <div className="text-destructive">Void{n.void_reason ? ` — ${n.void_reason}` : ""}</div>}
            {g.viewer.can("ia") && (
              <Link href={`/portal/ia/employees/${n.user_id}`} className="btn btn-outline mt-2 w-full !py-2">
                <FolderOpen size={14} /> Employee file
              </Link>
            )}
            <PrintButton />
          </div>
          {n.status === "pending" && <CountersignForm id={n.id} defaultName={g.viewer.displayName} />}
          {n.status !== "void" && (
            <details className="card p-5 text-sm">
              <summary className="cursor-pointer font-display uppercase tracking-wide text-destructive">Void agreement</summary>
              <form action={voidNda} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={n.id} />
                <p className="text-muted-foreground">Voiding means they&apos;ll need to sign again (for example after a name mistake).</p>
                <input name="reason" className="field" placeholder="Reason (optional)" maxLength={300} />
                <button className="btn btn-danger w-full !py-2">Void {ndaRef(n.id)}</button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
