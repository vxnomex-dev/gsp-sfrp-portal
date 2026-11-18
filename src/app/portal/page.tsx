import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList, FileWarning, PencilRuler, ArrowRight, BadgeCheck } from "lucide-react";
import { guard } from "./guard";
import { getCounts } from "@/lib/data";
import { avatarUrl } from "@/lib/discord";

export default function PortalHome() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const g = await guard("portal", "/portal");
  if (!g.viewer) return g.denied;
  const { viewer } = g;
  const counts = await getCounts();

  const tiles = [
    viewer.can("applications") && {
      href: "/portal/applications",
      icon: ClipboardList,
      title: "Cadet Applications",
      body: "Review, accept or deny cadet applications.",
      count: counts.appsPending,
      countLabel: "awaiting review",
    },
    viewer.can("reports") && {
      href: "/portal/reports",
      icon: FileWarning,
      title: "Employee Reports",
      body: "Professional Standards Bureau case files.",
      count: counts.reportsOpen,
      countLabel: "open cases",
    },
    viewer.can("content") && {
      href: "/portal/content",
      icon: PencilRuler,
      title: "Website Content",
      body: "Edit command staff and division commanders.",
    },
  ].filter(Boolean) as {
    href: string;
    icon: typeof ClipboardList;
    title: string;
    body: string;
    count?: number;
    countLabel?: string;
  }[];

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(viewer.uid, viewer.avatar)} alt="" className="h-16 w-16 rounded-full border-[3px] border-gold" />
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Welcome back,</div>
          <div className="font-display text-2xl uppercase text-navy-ink">{viewer.displayName}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {viewer.labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-sm bg-navy px-2 py-0.5 font-display text-xs uppercase tracking-wider text-white">
                <BadgeCheck size={12} className="text-gold" /> {l}
              </span>
            ))}
          </div>
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">
          Your access is synced from your Discord roles. Changes in Discord apply here within a minute.
        </p>
      </div>

      {tiles.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="card card-gold group p-6 transition-shadow hover:shadow-md">
              <t.icon className="text-navy" size={28} />
              <h2 className="mt-4 text-2xl font-semibold uppercase text-navy-ink">{t.title}</h2>
              <p className="mt-1 text-muted-foreground">{t.body}</p>
              {t.count !== undefined && (
                <div className="mt-4 font-display text-lg uppercase text-navy">
                  <span className="text-3xl text-navy-ink">{t.count}</span> {t.countLabel}
                </div>
              )}
              <div className="mt-4 inline-flex items-center gap-1 font-display text-sm uppercase tracking-wide text-navy group-hover:text-gold">
                Open <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-l-4 border-gold bg-panel px-6 py-5 text-muted-foreground">
          You&apos;re logged in as a Georgia State Patrol employee. Staff tools will appear here if you hold a command
          staff, application reviewer or Professional Standards Bureau role.
        </div>
      )}
    </div>
  );
}
