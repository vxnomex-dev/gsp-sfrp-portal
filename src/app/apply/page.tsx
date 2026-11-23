import { getConfig } from "@/lib/config";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/SiteChrome";
import { LoginRequired } from "@/components/LoginGate";
import { StatusBadge } from "@/components/StatusBadge";
import { getViewer } from "@/lib/session";
import { getMyApplications } from "@/lib/data";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { appRef } from "@/lib/forms";
import { ApplicationForm } from "./ApplicationForm";

export const metadata: Metadata = { title: "Cadet Application" };

export default function ApplyPage() {
  return (
    <>
      <PageHeader eyebrow="Recruitment" title="Cadet Application" image={site.images.headers.apply}>
        Reviewed by Florida Highway Patrol command staff. Answer every question honestly and in full sentences — low-effort
        applications are denied.
      </PageHeader>
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-5">
          <div className="mb-8 border-l-4 border-gold bg-panel px-6 py-5">
            <div className="font-display text-sm uppercase tracking-[0.12em] text-navy-ink">Before you apply</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.97rem] text-muted-foreground">
              {site.cadetRequirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <ApplyGate />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function ApplyGate() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <LoginRequired next="/apply" title="Log in to apply">
        Applications are linked to your Discord account so command staff can contact you about your result.
      </LoginRequired>
    );
  }

  const botReady = Boolean(env.discord.botToken && (await getConfig()).guildId);
  if (botReady && !viewer.inGuild) {
    return (
      <div className="card card-gold p-8 text-center">
        <h2 className="text-2xl font-semibold uppercase text-navy-ink">Join the Discord first</h2>
        <p className="mt-3 text-muted-foreground">
          You need to be a member of the {site.community} Discord server to apply. Join, then refresh this page.
        </p>
        {site.discordInvite && (
          <a className="btn btn-navy mt-6" href={site.discordInvite} target="_blank" rel="noreferrer">
            Join the Discord
          </a>
        )}
      </div>
    );
  }

  const { isBlacklisted } = await import("@/lib/discipline");
  if (await isBlacklisted(viewer.uid, viewer.roles)) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-2xl font-semibold uppercase text-navy-ink">You can&apos;t apply</h2>
        <p className="mt-3 text-muted-foreground">
          You are blacklisted from the Florida Highway Patrol, so you can&apos;t submit an application. If you think this is a
          mistake, open a Command Support ticket in the Discord.
        </p>
      </div>
    );
  }

  const mine = await getMyApplications(viewer.uid);
  const open = mine.find((a) => a.status === "pending" || a.status === "review");
  if (open) {
    return (
      <div className="card card-gold p-8 text-center">
        <h2 className="text-2xl font-semibold uppercase text-navy-ink">Application received</h2>
        <p className="mt-3 text-muted-foreground">
          Your application <strong className="text-navy-ink">{appRef(open.id)}</strong> is waiting for command staff
          review. You&apos;ll hear back in Discord.
        </p>
        <div className="mt-4">
          <StatusBadge kind="application" status={open.status} />
        </div>
      </div>
    );
  }

  return (
    <>
      {mine.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          Previous applications:
          {mine.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5">
              {appRef(a.id)} <StatusBadge kind="application" status={a.status} />
            </span>
          ))}
        </div>
      )}
      <ApplicationForm discordName={viewer.username} />
    </>
  );
}
