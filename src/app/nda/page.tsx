import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/SiteChrome";
import { LoginRequired } from "@/components/LoginGate";
import { NdaDocument } from "@/components/NdaDocument";
import { site } from "@/lib/site";
import { getViewer } from "@/lib/session";
import { currentNdaFor, ndaRef } from "@/lib/nda";
import { fmtDate } from "@/lib/format";
import { SignForm } from "./SignForm";
import { PrintButton } from "../portal/ia/PrintButton";

export const metadata: Metadata = { title: "Confidentiality Agreement" };

export default function NdaPage() {
  return (
    <>
      <PageHeader eyebrow="Florida Highway Patrol" title="Confidentiality Agreement" image={site.images.headers.department}>
        Every invitee signs the Confidentiality and Employment Agreement before joining the Patrol.
      </PageHeader>
      <section className="bg-panel py-12">
        <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-6">
          <Suspense fallback={<div className="card h-96 animate-pulse bg-card" />}>
            <Agreement />
          </Suspense>
        </div>
      </section>
    </>
  );
}

const day = (d: string | Date | null) => (d ? fmtDate(d).replace(/,\s*\d{1,2}:\d{2}.*$/, "") : null);

async function Agreement() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <LoginRequired next="/nda" title="Log in to sign">
        Log in with your Discord account to read and sign the Confidentiality and Employment Agreement.
      </LoginRequired>
    );
  }
  const nda = await currentNdaFor(viewer.uid);

  if (!nda) {
    return (
      <>
        <NdaDocument invitee={{ signature: null, name: null, date: null }} rep={{ signature: null, name: null, date: null }} />
        <SignForm defaultName={viewer.username} />
      </>
    );
  }

  return (
    <>
      <div className={`card flex flex-wrap items-center gap-4 p-5 print:hidden ${nda.status === "countersigned" ? "card-gold" : ""}`}>
        {nda.status === "countersigned" ? (
          <CheckCircle2 className="text-success" size={28} />
        ) : (
          <Clock className="text-navy" size={28} />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg uppercase text-navy-ink">
            {nda.status === "countersigned" ? "Agreement complete" : "Waiting for countersignature"}
          </div>
          <div className="text-sm text-muted-foreground">
            You signed on {fmtDate(nda.signed_at)}.
            {nda.status === "countersigned"
              ? ` Countersigned by ${nda.rep_signature} on ${fmtDate(nda.rep_signed_at)}.`
              : " A Department Representative will countersign it shortly."}
          </div>
        </div>
        <PrintButton />
      </div>
      <NdaDocument
        reference={ndaRef(nda.id)}
        invitee={{ signature: nda.signature, name: nda.full_name, date: day(nda.signed_at) }}
        rep={{ signature: nda.rep_signature, name: nda.rep_name, date: day(nda.rep_signed_at) }}
      />
    </>
  );
}
