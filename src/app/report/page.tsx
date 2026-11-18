import { Suspense } from "react";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { LoginRequired } from "@/components/LoginGate";
import { getViewer } from "@/lib/session";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report a Trooper" };

export default function ReportPage() {
  return (
    <>
      <PageHeader eyebrow="Human Resources" title="Report a Trooper" image={site.images.headers.report}>
        If a member of the Georgia State Patrol acted unprofessionally or broke the rules, let us know. Every report is
        reviewed by Human Resources.
      </PageHeader>
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-5">
          <div className="mb-8 flex gap-4 border-l-4 border-gold bg-panel px-6 py-5">
            <Lock className="mt-0.5 shrink-0 text-navy" size={20} />
            <div className="text-[0.97rem] text-muted-foreground">
              <div className="font-display text-sm uppercase tracking-[0.12em] text-navy-ink">Confidential</div>
              Reports are visible <strong>only</strong> to Human Resources and the Office of the Colonel. Your identity is
              never shared with the trooper you report. Clips or screenshots make it much easier for HR to act — upload
              them to YouTube, Medal, Imgur or Discord and paste the links below. False reports may result in
              disciplinary action.
            </div>
          </div>
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <ReportGate />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function ReportGate() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <LoginRequired next="/report" title="Log in to file a report">
        Logging in with Discord lets HR investigators follow up with you, and helps us prevent spam and false reports.
      </LoginRequired>
    );
  }
  return <ReportForm discordName={viewer.username} />;
}
