import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Gauge, Dog, ShieldAlert, Search, Scale, UserRound, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { getDivisions } from "@/lib/data";
import { buildRoster } from "@/lib/roster";
import { fmtCallsign } from "@/lib/callsign";

export const metadata: Metadata = { title: "Divisions" };

const icons: Record<string, LucideIcon> = {
  adu: Gauge,
  ia: Scale,
  canine: Dog,
  ciu: Search,
};

/** Division logos in /public/images/divisions — shown instead of the icon once added. */
const logos: Record<string, string> = {};

export default function DivisionsPage() {
  return (
    <>
      <PageHeader eyebrow="Specialized Units" title="Divisions" image={site.images.headers.divisions}>
        Beyond road patrol, the Florida Highway Patrol maintains specialized divisions. Every division is handpicked —
        members are chosen by division leadership from troopers who have proven themselves on the highway.
      </PageHeader>
      <section className="py-16">
        <div className="container-x">
          <Suspense fallback={<div className="grid gap-6">{[0, 1, 2].map((i) => <div key={i} className="card h-56 animate-pulse bg-panel" />)}</div>}>
            <DivisionList />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function DivisionList() {
  await connection();
  const divisions = await getDivisions();
  // Commanders come from the roster (their callsign seat) unless one is typed in on the portal
  const roster = await buildRoster()
    .then((r) => r.entries)
    .catch(() => []);
  const commanderOf = (cs: number | null) => {
    if (cs === null) return null;
    const e = roster.find((r) => r.callsign === cs);
    return e ? `${fmtCallsign(cs)} | ${e.name}` : null;
  };
  return (
    <div className="grid gap-6">
      {divisions.map((d) => {
        const Icon = icons[d.slug] ?? ShieldAlert;
        const commander = d.commander || commanderOf(d.commander_callsign);
        const duties = d.duties.split("\n").map((s) => s.trim()).filter(Boolean);
        return (
          <article key={d.slug} id={d.slug} className="card card-gold grid scroll-mt-48 gap-6 p-7 md:grid-cols-[1fr_17rem]">
            <div>
              <div className="flex items-center gap-4">
                {logos[d.slug] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logos[d.slug]} alt={`${d.name} logo`} className="h-20 w-20 shrink-0 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-navy text-gold">
                    <Icon size={28} />
                  </div>
                )}
                <div>
                  <div className="font-display text-sm uppercase tracking-[0.18em] text-muted-foreground">{d.abbreviation}</div>
                  <h2 className="text-3xl font-semibold uppercase leading-tight text-navy-ink">{d.name}</h2>
                </div>
              </div>
              <p className="mt-4 text-lg text-muted-foreground">{d.summary}</p>
              {duties.length > 0 && (
                <ul className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {duties.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[0.97rem]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-gold" />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <aside className="flex flex-col gap-3 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div className="field-label !mb-0">Division Commander</div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-panel text-muted-foreground">
                  <UserRound size={22} />
                </div>
                {commander ? (
                  <span className="font-display text-lg uppercase text-navy-ink">{commander}</span>
                ) : (
                  <span className="font-display text-lg uppercase tracking-wide text-muted-foreground">Vacant</span>
                )}
              </div>
              <div className="field-label !mb-0 mt-2">Recruitment</div>
              <div>
                {d.recruitment === "handpicked" ? (
                  <span className="inline-block rounded-sm bg-gold px-2 py-0.5 font-display text-sm uppercase tracking-wide text-gold-foreground">
                    Handpicked
                  </span>
                ) : d.recruitment === "open" ? (
                  <span className="inline-block rounded-sm bg-[oklch(93%_0.06_155)] px-2 py-0.5 font-display text-sm uppercase tracking-wide text-[oklch(38%_0.11_155)]">
                    Open
                  </span>
                ) : (
                  <span className="inline-block rounded-sm bg-muted px-2 py-0.5 font-display text-sm uppercase tracking-wide text-muted-foreground">
                    Closed
                  </span>
                )}
              </div>
              {d.restricted && (
                <p className="text-sm text-muted-foreground">
                  {d.recruitment === "handpicked"
                    ? "There are no applications — members are handpicked by division leadership."
                    : "Assignment to this division is by command staff appointment only."}
                </p>
              )}
            </aside>
          </article>
        );
      })}
    </div>
  );
}
