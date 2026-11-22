import { Suspense } from "react";
import type { Metadata } from "next";
import { Car, Check, Lock, Minus, ShieldCheck, Lightbulb, Info, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { guard } from "@/app/portal/guard";
import { env } from "@/lib/env";
import { RANKS, TIERS, rankForRoles, type RankKey } from "@/lib/roster";
import { FLEET, PACKAGES, authorized, minRankText, rankLabel } from "@/lib/vehicles";
import { SOP, SOP_META, type SopSubsection } from "@/lib/sop";

export const metadata: Metadata = { title: "Department Information", robots: { index: false, follow: false } };

const SECTIONS = [
  { id: "vehicles", label: "Vehicle Regulations", icon: Car, children: [] as { id: string; label: string }[] },
  {
    id: "sop",
    label: "Standard Operating Procedure",
    icon: BookOpen,
    children: SOP.map((s) => ({ id: s.id, label: `${s.numeral}. ${s.title}` })),
  },
];

export default function DepartmentPage() {
  return (
    <>
      <PageHeader eyebrow="Department Personnel Only" title="Department Information" image={site.images.headers.department}>
        Internal reference for sworn members of the Florida Highway Patrol. Do not share outside the department.
      </PageHeader>
      <section className="py-14">
        <div className="container-x">
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <Content />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Content() {
  const g = await guard("portal", "/department");
  if (!g.viewer) return g.denied;
  const viewer = g.viewer;
  // Local preview login has no Discord roles: DEV_RANK=cpl etc. shows the page as that rank.
  const rank = viewer.dev && env.devLogin ? ((process.env.DEV_RANK as RankKey | undefined) ?? null) : await rankForRoles(viewer.roles);

  return (
    <div className="grid gap-10 lg:grid-cols-[14rem_1fr]">
      <aside className="lg:sticky lg:top-48 lg:self-start">
        <div className="eyebrow !text-muted-foreground mb-3">Sections</div>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 border-l-[3px] border-gold bg-panel px-3 py-2.5 font-display text-sm uppercase tracking-wide text-navy-ink"
              >
                <s.icon size={16} className="shrink-0 text-navy" /> {s.label}
              </a>
              {s.children.length > 0 && (
                <ul className="mb-1 ml-[3px] border-l border-border py-1">
                  {s.children.map((c) => (
                    <li key={c.id}>
                      <a href={`#${c.id}`} className="block px-4 py-1.5 text-sm text-muted-foreground hover:text-navy-ink">
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2 text-xs text-muted-foreground">
          <Lock size={14} className="mt-0.5 shrink-0" />
          Visible only to logged-in department personnel.
        </div>
      </aside>

      <div className="min-w-0 space-y-12">
        <VehicleRegulations rank={rank} name={viewer.displayName} />
        <StandardOperatingProcedure />
      </div>
    </div>
  );
}

function Status({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-success">
      <Check size={14} strokeWidth={3} /> Authorized
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-muted-foreground">
      <Lock size={13} /> Not authorized
    </span>
  );
}

function VehicleRegulations({ rank, name }: { rank: RankKey | null; name: string }) {
  const columns = [
    ...FLEET.map((v) => ({ key: v.key, top: v.short, sub: v.real.replace(/ (Pursuit|PPV|Interceptor Utility)$/, ""), min: v.minRank })),
    ...PACKAGES.filter((p) => p.key !== "marked").map((p) => ({ key: p.key, top: p.name, sub: "Set-up", min: p.minRank })),
  ];

  return (
    <section id="vehicles" className="scroll-mt-48 space-y-10">
      <header>
        <div className="eyebrow mb-1">Section 1</div>
        <h2 className="text-4xl font-semibold uppercase text-navy-ink">Vehicle Regulations</h2>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          Patrol vehicles are issued by rank. Spawn only the vehicles and set-ups authorized for your rank. Every name
          below is exactly as it appears in the ER:LC vehicle menu.
        </p>
      </header>

      {/* Your authorization */}
      <div className="card card-gold p-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <ShieldCheck className="text-navy" size={30} />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Your authorization</div>
            <div className="font-display text-xl uppercase text-navy-ink">
              {name}
              {rank && <span className="text-muted-foreground"> · {rankLabel(rank)}</span>}
            </div>
          </div>
        </div>
        {rank ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[...FLEET.map((v) => ({ key: v.key, label: v.erlc, min: v.minRank })), ...PACKAGES.filter((p) => p.key !== "marked").map((p) => ({ key: p.key, label: p.name, min: p.minRank }))].map((i) => {
              const ok = authorized(rank, i.min);
              return (
                <div
                  key={i.key}
                  className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-sm ${ok ? "border-border bg-card text-navy-ink" : "border-dashed border-border bg-panel/60 text-muted-foreground"}`}
                >
                  {ok ? <Check size={16} strokeWidth={3} className="shrink-0 text-success" /> : <Lock size={14} className="shrink-0" />}
                  <span className="truncate">{i.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No “FHP | Rank” role was found on your Discord account, so we can&apos;t show your personal authorization.
            Use the rank chart below.
          </p>
        )}
      </div>

      {/* Fleet */}
      <div>
        <h3 className="mb-4 text-2xl font-semibold uppercase text-navy-ink">Authorized Fleet</h3>
        <div className="grid gap-5 md:grid-cols-2">
          {FLEET.map((v) => (
            <article key={v.key} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-navy px-5 py-2.5 text-white">
                <span className="inline-flex items-center gap-2 font-display text-xs uppercase tracking-[0.16em] text-white/80">
                  <Car size={15} className="text-gold" /> {v.type}
                </span>
                <span className="rounded-sm bg-gold px-2 py-0.5 font-display text-xs uppercase tracking-wider text-gold-foreground">
                  {minRankText(v.minRank)}
                </span>
              </div>
              <div className="p-5">
                <div className="font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">In-game name</div>
                <h4 className="text-2xl font-semibold uppercase leading-tight text-navy-ink">{v.erlc}</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.years.map((y) => (
                    <span key={y} className="rounded-sm border border-border bg-panel px-2 py-0.5 font-display text-xs tracking-wider text-navy-ink">
                      {y}
                    </span>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-[7.5rem_1fr] gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Real-world</dt>
                  <dd className="font-medium text-navy-ink">{v.real}</dd>
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd className="text-navy-ink">{v.assignment}</dd>
                </dl>
                {rank && (
                  <div className="mt-4 border-t border-border pt-3">
                    <Status ok={authorized(rank, v.minRank)} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Set-ups */}
      <div>
        <h3 className="mb-1 text-2xl font-semibold uppercase text-navy-ink">Lighting &amp; Livery Set-ups</h3>
        <p className="mb-4 text-muted-foreground">
          Applies to every vehicle above. Slick tops are for supervisors and above; ghosted set-ups are for Lieutenants
          and above.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {PACKAGES.map((p) => (
            <div key={p.key} className="card card-gold flex flex-col p-5">
              <div className="flex items-center gap-2">
                <Lightbulb size={18} className="text-navy" />
                <h4 className="text-xl font-semibold uppercase text-navy-ink">{p.name}</h4>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="font-display text-xs uppercase tracking-wider text-navy">{minRankText(p.minRank)}</span>
                {rank && <Status ok={authorized(rank, p.minRank)} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rank chart */}
      <div>
        <h3 className="mb-1 text-2xl font-semibold uppercase text-navy-ink">Rank Chart</h3>
        <p className="mb-4 text-muted-foreground">Everything each rank may spawn at a glance.</p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-4 py-3 font-display text-xs uppercase tracking-wider">Rank</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-3 text-center align-bottom">
                    <div className="font-display text-xs uppercase leading-tight tracking-wider">{c.top}</div>
                    <div className="mt-0.5 text-[0.7rem] font-normal normal-case text-white/65">{c.sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <TierRows key={t.key} tierKey={t.key} label={t.label} columns={columns} rank={rank} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3 border-l-4 border-gold bg-panel px-5 py-4 text-sm text-muted-foreground">
        <Info size={18} className="mt-0.5 shrink-0 text-navy" />
        Higher ranks may use any vehicle or set-up authorized for the ranks below them. Questions about vehicle
        authorization go to your chain of command.
      </div>
    </section>
  );
}

function TierRows({
  tierKey,
  label,
  columns,
  rank,
}: {
  tierKey: string;
  label: string;
  columns: { key: string; min: RankKey }[];
  rank: RankKey | null;
}) {
  const ranks = RANKS.filter((r) => r.tier === tierKey);
  return (
    <>
      <tr>
        <td colSpan={columns.length + 1} className="border-t border-border bg-panel px-4 py-1.5 font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </td>
      </tr>
      {ranks.map((r) => {
        const mine = r.key === rank;
        return (
          <tr key={r.key} className={`border-t border-border ${mine ? "bg-gold/15" : ""}`}>
            <td className={`whitespace-nowrap px-4 py-2.5 font-medium text-navy-ink ${mine ? "border-l-[3px] border-gold" : ""}`}>
              {r.label}
              {mine && <span className="ml-2 rounded-sm bg-navy px-1.5 py-0.5 font-display text-[0.65rem] uppercase tracking-wider text-white">You</span>}
            </td>
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2.5 text-center">
                {authorized(r.key, c.min) ? (
                  <Check size={18} strokeWidth={3} className="mx-auto text-navy" aria-label="Authorized" />
                ) : (
                  <Minus size={16} className="mx-auto text-border" aria-label="Not authorized" />
                )}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2 — Standard Operating Procedure                            */
/* ------------------------------------------------------------------ */

function Subsection({ s }: { s: SopSubsection }) {
  return (
    <div className="grid gap-x-5 gap-y-2 px-6 py-5 sm:grid-cols-[4.5rem_1fr]">
      <div>
        <span className="inline-block min-w-14 rounded-sm bg-navy px-2 py-0.5 text-center font-display tracking-wider text-gold">
          {s.num}
        </span>
      </div>
      <div className="min-w-0">
        <h5 className="font-display text-lg uppercase leading-snug text-navy-ink">{s.title}</h5>
        {s.body.map((p, i) =>
          typeof p === "string" ? (
            <p key={i} className="mt-2 leading-relaxed text-foreground/90">
              {p}
            </p>
          ) : (
            <p key={i} className="mt-3 border-l-[3px] border-gold bg-panel px-4 py-3 leading-relaxed text-foreground/90">
              <strong className="text-navy-ink">{p.lead}</strong> {p.text}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

function StandardOperatingProcedure() {
  const count = (id: string) => SOP.find((x) => x.id === id)!.groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section id="sop" className="scroll-mt-48 space-y-10 border-t border-border pt-12">
      <header>
        <div className="eyebrow mb-1">Section 2</div>
        <h2 className="text-4xl font-semibold uppercase text-navy-ink">{SOP_META.title}</h2>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          The {SOP_META.subtitle}. Every trooper is expected to know and follow these procedures on and off patrol.
        </p>
        <p className="mt-2 font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
          Author: <span className="text-navy-ink">{SOP_META.author}</span>
        </p>
      </header>

      {/* Contents */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SOP.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="card group overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-3 bg-navy px-5 py-2.5 text-white">
              <span className="font-display text-xs uppercase tracking-[0.16em] text-white/80">Section {s.numeral}</span>
              <span className="rounded-sm bg-gold px-2 py-0.5 font-display text-xs uppercase tracking-wider text-gold-foreground">
                {count(s.id)} subsections
              </span>
            </div>
            <div className="px-5 py-4">
              <h4 className="text-xl font-semibold uppercase leading-tight text-navy-ink group-hover:text-navy">{s.title}</h4>
              {s.groups.some((g) => g.title) && (
                <p className="mt-1 text-sm text-muted-foreground">{s.groups.map((g) => g.title).filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </a>
        ))}
      </div>

      {SOP.map((s) => (
        <article key={s.id} id={s.id} className="card scroll-mt-48 overflow-hidden">
          <div className="flex items-center gap-4 bg-navy px-6 py-4 text-white">
            <span className="font-display text-3xl text-gold">{s.numeral}</span>
            <div>
              <div className="font-display text-xs uppercase tracking-[0.18em] text-white/70">Section {s.numeral}</div>
              <h3 className="text-2xl font-semibold uppercase leading-tight">{s.title}</h3>
            </div>
          </div>
          {s.groups.map((g, gi) => (
            <div key={gi}>
              {g.title && (
                <div className="border-y border-border bg-panel px-6 py-2 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {g.title}
                </div>
              )}
              <div className="divide-y divide-border">
                {g.items.map((it) => (
                  <Subsection key={`${s.id}-${it.num}`} s={it} />
                ))}
              </div>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
