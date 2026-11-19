import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/SiteChrome";
import { LoginRequired } from "@/components/LoginGate";
import { site } from "@/lib/site";
import { getViewer } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { getPrefs, DEFAULT_PREFS } from "@/lib/notifications";
import { ProfileForm } from "./form";

export const metadata: Metadata = { title: "Profile & Settings", robots: { index: false } };

export default function ProfilePage() {
  return (
    <>
      <PageHeader eyebrow="Your Account" title="Profile & Settings" image={site.images.headers.profile} />
      <section className="py-14">
        <div className="container-x max-w-4xl">
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <Profile />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Profile() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <LoginRequired next="/profile" title="Log in to continue">
        Log in with Discord to choose which notifications you&apos;re sent and how the site looks.
      </LoginRequired>
    );
  }
  const prefs = await getPrefs(viewer.uid).catch(() => DEFAULT_PREFS);

  return (
    <div className="space-y-8">
      <div className="card card-gold flex flex-wrap items-center gap-5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(viewer.uid, viewer.avatar)} alt="" className="h-16 w-16 rounded-full border-[3px] border-gold" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl uppercase text-navy-ink">{viewer.displayName}</div>
          <div className="text-muted-foreground">@{viewer.username}</div>
          {viewer.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {viewer.labels.map((l) => (
                <span key={l} className="rounded-sm bg-navy px-2 py-0.5 font-display text-xs uppercase tracking-wider text-white">
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
        {!viewer.inGuild && (
          <p className="max-w-xs text-sm text-muted-foreground">
            You&apos;re not in the {site.community} Discord, so the bot can&apos;t DM you until you join.
          </p>
        )}
      </div>

      <ProfileForm
        personnel={viewer.can("portal")}
        initial={{ dm_alerts: prefs.dm_alerts, dm_press: prefs.dm_press, dm_info: prefs.dm_info, theme: prefs.theme }}
      />
    </div>
  );
}
