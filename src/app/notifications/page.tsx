import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Bell, BellRing, Megaphone, Siren, Info, LogIn } from "lucide-react";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { getViewer } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { NOTIFICATION_KINDS, badgeFor, listNotifications, visibleKinds, type NotificationKind } from "@/lib/notifications";

export const metadata: Metadata = { title: "Notification Center" };

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <>
      <PageHeader eyebrow="Public Information" title="Notification Center" image={site.images.headers.notifications}>
        Statewide alerts and press releases from the Florida Highway Patrol.
      </PageHeader>
      <section className="py-14">
        <div className="container-x">
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <Feed searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

const icons = { alert: Siren, press: Megaphone, info: Info } as const;

function badgeClass(kind: NotificationKind) {
  if (kind === "alert") return "bg-destructive text-white";
  if (kind === "info") return "bg-gold text-gold-foreground";
  return "bg-navy text-white";
}

async function Feed({ searchParams }: { searchParams: PageProps<"/notifications">["searchParams"] }) {
  await connection();
  const [viewer, sp] = await Promise.all([getViewer(), searchParams]);
  const kinds = visibleKinds(viewer?.permissions ?? null);
  const filter = kinds.find((k) => k === sp.type) ?? null;
  const items = await listNotifications(filter ? [filter] : kinds, 100).catch(() => []);
  const publish = viewer && (viewer.can("alerts") || viewer.can("press") || viewer.can("notices"));

  const tabs: { key: NotificationKind | null; label: string }[] = [
    { key: null, label: "All" },
    ...kinds.map((k) => ({ key: k, label: NOTIFICATION_KINDS[k].plural })),
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_19rem]">
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={t.key ? `/notifications?type=${t.key}` : "/notifications"}
              className={`rounded-sm border px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
                filter === t.key ? "border-navy bg-navy text-white" : "border-border bg-card text-navy hover:border-navy"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="card p-10 text-center text-muted-foreground">
            <Bell className="mx-auto mb-3 opacity-40" size={36} />
            Nothing has been published here yet.
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((n) => {
              const Icon = icons[n.kind] ?? Bell;
              return (
                <article key={n.id} id={`n-${n.id}`} className="notice card scroll-mt-48 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-display text-xs uppercase tracking-[0.14em] ${badgeClass(n.kind)}`}>
                      <Icon size={14} /> {badgeFor(n)}
                    </span>
                    <time className="text-sm text-muted-foreground">{fmtDate(n.created_at)}</time>
                  </div>
                  <div className="px-6 py-5">
                    <h2 className="text-2xl font-semibold uppercase leading-tight text-navy-ink">{n.title}</h2>
                    <p className="mt-3 whitespace-pre-line text-[1.02rem] leading-relaxed">{n.body}</p>
                    <p className="mt-4 text-sm text-muted-foreground">Issued by {NOTIFICATION_KINDS[n.kind].issuer}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
        <div className="card card-gold p-6">
          <BellRing className="text-navy" size={28} />
          <h3 className="mt-3 text-xl font-semibold uppercase text-navy-ink">Get these in your DMs</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which notifications the FHP bot sends you on Discord — statewide alerts, press releases or both.
          </p>
          {viewer ? (
            <Link href="/profile#notifications" className="btn btn-navy mt-4 w-full">
              Notification settings
            </Link>
          ) : (
            <a href="/api/auth/login?next=/profile" className="btn btn-navy mt-4 w-full">
              <LogIn size={16} /> Log in to subscribe
            </a>
          )}
        </div>
        <div className="card space-y-3 p-6 text-sm">
          {kinds.map((k) => {
            const Icon = icons[k];
            return (
              <div key={k} className="flex gap-3">
                <Icon size={18} className="mt-0.5 shrink-0 text-navy" />
                <div>
                  <div className="font-semibold text-navy-ink">{NOTIFICATION_KINDS[k].plural}</div>
                  <div className="text-muted-foreground">{NOTIFICATION_KINDS[k].blurb}</div>
                </div>
              </div>
            );
          })}
        </div>
        {publish && (
          <Link href="/portal/notifications" className="btn btn-gold w-full">
            <Megaphone size={16} /> Publish a release
          </Link>
        )}
      </aside>
    </div>
  );
}
