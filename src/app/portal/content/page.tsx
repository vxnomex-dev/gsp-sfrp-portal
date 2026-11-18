import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { getCommandStaff, getDivisions } from "@/lib/data";
import { DivisionEditor, StaffEditor } from "./editors";

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <ContentEditor />
    </Suspense>
  );
}

async function ContentEditor() {
  const g = await guard("content", "/portal/content");
  if (!g.viewer) return g.denied;
  const [staff, divisions] = await Promise.all([getCommandStaff(), getDivisions()]);

  return (
    <div className="space-y-12">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Website Content</h2>
        <p className="mt-1 text-muted-foreground">Changes go live on the public site immediately.</p>
      </div>

      <section>
        <h3 className="mb-4 border-b-[3px] border-gold pb-2 font-display text-2xl uppercase text-navy-ink">Command Staff</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          {staff.map((s) => (
            <StaffEditor key={s.id} member={s} />
          ))}
          <StaffEditor />
        </div>
      </section>

      <section>
        <h3 className="mb-4 border-b-[3px] border-gold pb-2 font-display text-2xl uppercase text-navy-ink">Divisions</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          {divisions.map((d) => (
            <DivisionEditor key={d.slug} division={d} />
          ))}
        </div>
      </section>
    </div>
  );
}
