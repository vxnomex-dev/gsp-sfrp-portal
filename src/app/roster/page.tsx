import { Suspense } from "react";
import { after, connection } from "next/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { avatarUrl } from "@/lib/discord";
import { RANKS, TIERS, buildRoster, syncIfStale, type RosterEntry } from "@/lib/roster";

export const metadata: Metadata = { title: "Roster" };
export const maxDuration = 300;

export default function RosterPage() {
  return (
    <>
      <PageHeader eyebrow="Chain of Command" title="Department Roster" image={site.images.headers.roster}>
        Every sworn member of the Georgia State Patrol, synced live from the South Fulton Roleplay Discord.
      </PageHeader>
      <section className="py-14">
        <div className="container-x">
          <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
            <Roster />
          </Suspense>
        </div>
      </section>
    </>
  );
}

type Row = { key: string; callsign: number | null; rank: string; entry: RosterEntry | null };

async function Roster() {
  await connection();
  let entries: RosterEntry[];
  try {
    entries = (await buildRoster()).entries;
  } catch (e) {
    console.error("[roster] load failed", e);
    return (
      <div className="border-l-4 border-gold bg-panel px-6 py-5 text-muted-foreground">
        The roster is temporarily unavailable. Please check back shortly.
      </div>
    );
  }
  // Keep callsigns and nicknames in step with Discord (at most every 10 minutes)
  after(syncIfStale);

  const groups: { key: string; label: string; rows: Row[]; filled: number }[] = TIERS.map((tier) => {
    const ranks = RANKS.filter((r) => r.tier === tier.key);
    const rows: Row[] = [];
    for (const r of ranks) {
      const members = entries.filter((e) => e.rank === r.key);
      if (tier.showVacancies) {
        // Every callsign in the block, filled or Vacant
        for (let n = r.block[0]; n <= r.block[1]; n++) {
          const e = members.find((m) => m.callsign === n) ?? null;
          rows.push({ key: `${r.key}-${n}`, callsign: n, rank: r.label, entry: e });
        }
        for (const e of members.filter((m) => m.callsign === null)) rows.push({ key: e.userId, callsign: null, rank: r.label, entry: e });
      } else {
        for (const e of members) rows.push({ key: e.userId, callsign: e.callsign, rank: r.label, entry: e });
      }
    }
    return { key: tier.key, label: tier.label, rows, filled: rows.filter((x) => x.entry).length };
  });
  const others = entries.filter((e) => !e.rank);
  if (others.length) {
    groups.push({
      key: "other",
      label: "Cadets & Personnel",
      rows: others.map((e) => ({ key: e.userId, callsign: null, rank: "—", entry: e })),
      filled: others.length,
    });
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-3">
        <Stat label="Total members" value={entries.length} />
        {groups.map((g) => (
          <Stat key={g.key} label={g.label} value={g.filled} />
        ))}
      </div>

      {groups
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.key}>
            <h2 className="mb-3 border-b-[3px] border-gold pb-2 text-2xl font-semibold uppercase text-navy-ink">{g.label}</h2>
            <div className="card overflow-x-auto">
              <table className="w-full table-fixed text-left text-[0.97rem]">
                <thead className="border-b border-border bg-panel font-display text-xs uppercase tracking-wider text-navy">
                  <tr>
                    <th className="w-28 px-4 py-3">Callsign</th>
                    <th className="w-1/2 px-4 py-3">Name</th>
                    <th className="px-4 py-3">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row) => (
                    <tr key={row.key} className={`border-b border-border last:border-0 ${row.entry ? "" : "bg-muted/40"}`}>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block min-w-14 rounded-sm px-2 py-0.5 text-center font-display tracking-wider ${
                            row.entry ? "bg-navy text-white" : "border border-dashed border-border text-muted-foreground"
                          }`}
                        >
                          {row.callsign ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.entry ? (
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatarUrl(row.entry.userId, row.entry.avatar)} alt="" className="h-8 w-8 rounded-full" loading="lazy" />
                            <span className="truncate font-semibold text-navy-ink">{row.entry.name}</span>
                          </div>
                        ) : (
                          <span className="font-display uppercase tracking-wide text-muted-foreground">Vacant</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card min-w-36 px-4 py-3">
      <div className="font-display text-2xl text-navy-ink">{value}</div>
      <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
