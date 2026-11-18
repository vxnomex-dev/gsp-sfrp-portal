import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../../guard";
import { getApplication } from "@/lib/data";
import { appRef } from "@/lib/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import { avatarUrl } from "@/lib/discord";
import { DecisionForm } from "./DecisionForm";

export default function ApplicationPage({ params }: PageProps<"/portal/applications/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <ApplicationDetail params={params} />
    </Suspense>
  );
}

async function ApplicationDetail({ params }: { params: PageProps<"/portal/applications/[id]">["params"] }) {
  const { id } = await params;
  const g = await guard("applications", `/portal/applications/${id}`);
  if (!g.viewer) return g.denied;

  const app = await getApplication(Number(id));
  if (!app || !Number.isInteger(Number(id))) {
    return <p className="text-muted-foreground">Application not found.</p>;
  }

  return (
    <div>
      <Link href="/portal/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft size={16} /> All applications
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="card card-gold flex flex-wrap items-center gap-5 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl(app.discord_id, app.discord_avatar)} alt="" className="h-16 w-16 rounded-full" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-semibold uppercase text-navy-ink">{appRef(app.id)}</h2>
                <StatusBadge kind="application" status={app.status} />
              </div>
              <div className="mt-1 text-muted-foreground">Submitted {fmtDate(app.created_at)}</div>
            </div>
          </div>

          <dl className="card grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
            {[
              ["Discord", `@${app.discord_username}`],
              ["Discord ID", app.discord_id],
              ["Roblox", app.roblox_username],
              ["Age", String(app.age)],
              ["Timezone", app.timezone],
              ["Availability", app.availability],
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="field-label !mb-0.5">{k}</dt>
                <dd className="break-words">{val}</dd>
              </div>
            ))}
          </dl>

          {app.answers.map((a) => (
            <div key={a.key} className="card p-6">
              <h3 className="font-display text-lg uppercase text-navy">{a.question}</h3>
              <p className="mt-2 whitespace-pre-wrap text-[0.98rem]">{a.answer || <em className="text-muted-foreground">No answer</em>}</p>
            </div>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-48 lg:self-start">
          <DecisionForm id={app.id} status={app.status} notes={app.review_notes ?? ""} />
          {app.reviewer_name && (
            <p className="text-sm text-muted-foreground">
              Last updated by <strong>{app.reviewer_name}</strong> on {fmtDate(app.reviewed_at)}
            </p>
          )}
          {app.webhook_ok === false && (
            <p className="text-sm text-destructive">The Discord notification for this application failed to send.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
