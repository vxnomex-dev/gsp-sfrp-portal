import { Suspense } from "react";
import { connection } from "next/server";
import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { getCommandStaff } from "@/lib/data";

export const metadata: Metadata = { title: "Command Staff" };

export default function CommandStaffPage() {
  return (
    <>
      <PageHeader eyebrow="Office of the Colonel" title="Command Staff" image={site.images.headers.commandStaff}>
        The senior leadership of the Georgia State Patrol, responsible for the direction, discipline and reputation of the
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

async function StaffGrid() {
  await connection();
  const staff = await getCommandStaff();
  const pending = staff.some((s) => !s.photo_url);
  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <article key={s.id} className="card overflow-hidden">
            <div className="relative aspect-[4/3.4] border-b-[3px] border-gold bg-panel">
              {s.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo_url} alt={`${s.rank} ${s.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <UserRound size={44} strokeWidth={1.4} />
                  <span className="font-display text-xs uppercase tracking-[0.2em]">Official photo pending</span>
                </div>
              )}
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-semibold uppercase text-navy-ink">
                {s.rank} {s.name}
              </h2>
              <div className="mt-1 font-display uppercase tracking-wide text-navy">
                {s.rank} — {s.title}
              </div>
              {s.bio && <p className="mt-3 text-muted-foreground">{s.bio}</p>}
            </div>
          </article>
        ))}
      </div>
      {pending && (
        <div className="mt-10 border-l-4 border-gold bg-panel px-5 py-4 text-muted-foreground">
          Official command staff portraits will be published once the department photoshoot is released.
        </div>
      )}
    </>
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
