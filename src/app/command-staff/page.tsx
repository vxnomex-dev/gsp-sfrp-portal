import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { avatarUrl } from "@/lib/discord";
import { fmtCallsign } from "@/lib/callsign";
import { TIERS, assignmentFor, buildRoster, getAssignments, rankInfo } from "@/lib/roster";

export const metadata: Metadata = { title: "Command Staff" };

export default function CommandStaffPage() {
  return (
    <>
      <PageHeader eyebrow="Office of the Colonel" title="Command Staff" image={site.images.headers.commandStaff}>
        The senior leadership of the Florida Highway Patrol, responsible for the direction, discipline and reputation of the
        department.
      </PageHeader>
      <section className="py-16">
        <div className="container-x">
          <Suspense fallback={<StaffSkeleton />}>
            <StaffGrid />
          </Suspense>
        </div>
      </section>
    </>
  );
}

type StaffCard = { key: string; name: string; rank: string; title: string | null; callsign: string | null; photo: string };

/** Command staff come straight from Discord: everyone in the Office of the Colonel and Command, with their Discord picture. */
async function StaffGrid() {
  await connection();
  let groups: { label: string; people: StaffCard[] }[] = [];
  try {
    const [{ entries }, assignments] = await Promise.all([buildRoster(), getAssignments()]);
    groups = TIERS.filter((t) => t.key === "ootc" || t.key === "command").map((t) => ({
      label: t.label,
      people: entries
        .filter((e) => e.rank && rankInfo(e.rank).tier === t.key)
        .map((e) => ({
          key: e.userId,
          name: e.name,
          rank: rankInfo(e.rank!).label,
          title: assignmentFor(assignments, e.rank, e.callsign) ?? null,
          callsign: e.callsign !== null ? fmtCallsign(e.callsign) : null,
          photo: avatarUrl(e.userId, e.avatar).replace("size=128", "size=512"),
        })),
    }));
  } catch (e) {
    console.error("[command-staff] roster unavailable", e);
  }

  if (!groups.some((g) => g.people.length)) {
    return (
      <div className="border-l-4 border-gold bg-panel px-6 py-5 text-muted-foreground">
        The command staff list is temporarily unavailable. Please check back shortly.
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {groups
        .filter((g) => g.people.length)
        .map((g, gi) => (
          <div key={g.label}>
            <h2 className="mb-6 border-b-[3px] border-gold pb-2 text-3xl font-semibold uppercase text-navy-ink">{g.label}</h2>
            <div className={`grid gap-8 ${gi === 0 ? "md:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
              {g.people.map((p) => (
                <article key={p.key} className="card overflow-hidden">
                  <div className="relative aspect-square border-b-[3px] border-gold bg-navy-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo} alt={`${p.rank} ${p.name}`} className="h-full w-full object-cover" loading="lazy" />
                    {p.callsign && (
                      <span className="absolute left-3 top-3 rounded-sm bg-navy px-2 py-0.5 font-display tracking-wider text-white">
                        {p.callsign}
                      </span>
                    )}
                  </div>
                  <div className={gi === 0 ? "p-6" : "p-4"}>
                    <h3 className={`${gi === 0 ? "text-2xl" : "text-xl"} font-semibold uppercase leading-tight text-navy-ink`}>
                      {p.rank} {p.name}
                    </h3>
                    {p.title && <div className="mt-1 font-display uppercase tracking-wide text-navy">{p.title}</div>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function StaffSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-[30rem] animate-pulse bg-panel" />
      ))}
    </div>
  );
}
