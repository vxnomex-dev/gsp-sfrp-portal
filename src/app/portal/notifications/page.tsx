import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { guard } from "../guard";
import { fmtDate } from "@/lib/format";
import { ALERT_TYPES, NOTIFICATION_KINDS, badgeFor, getNotification, listNotifications, type NotificationKind } from "@/lib/notifications";
import { removeNotification } from "@/app/actions";
import { ComposeForm } from "./form";

export const maxDuration = 300; // DMs go out in the background after publishing

export default function PublishPage({ searchParams }: PageProps<"/portal/notifications">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-panel" />}>
      <Publish searchParams={searchParams} />
    </Suspense>
  );
}

async function Publish({ searchParams }: { searchParams: PageProps<"/portal/notifications">["searchParams"] }) {
  const g = await guard(["alerts", "press", "notices"], "/portal/notifications");
  if (!g.viewer) return g.denied;
  const viewer = g.viewer;
  const allowed = (Object.keys(NOTIFICATION_KINDS) as NotificationKind[]).filter((k) => viewer.can(NOTIFICATION_KINDS[k].permission));
  const recent = await listNotifications(allowed, 30);
  const editId = Number((await searchParams).edit);
  const found = editId ? await getNotification(editId) : null;
  const editing = found && allowed.includes(found.kind) ? found : null;

  return (
    <div className="space-y-8">
      <div>
        {viewer.can("portal") && (
          <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
            <ChevronLeft size={16} /> Portal
          </Link>
        )}
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Publish a Release</h2>
        <p className="mt-1 text-muted-foreground">
          Releases appear in the <Link className="text-navy underline" href="/notifications">notification center</Link>{" "}
          straight away, and the bot DMs everyone who turned that type on in their profile.
        </p>
      </div>

      <div id="compose" className="card card-gold scroll-mt-40 p-6">
        {editing && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-panel px-4 py-3 text-sm">
            <span>
              Editing <strong>{editing.title}</strong>
              {editing.kind === "press" && " — the post in the press channel is updated too."}
            </span>
            <Link href="/portal/notifications" className="font-semibold text-navy underline">
              Cancel
            </Link>
          </div>
        )}
        <ComposeForm
          key={editing ? `edit-${editing.id}` : "new"}
          editing={editing ? { id: editing.id, kind: editing.kind, alert_type: editing.alert_type ?? "", title: editing.title, body: editing.body } : null}
          kinds={allowed.map((k) => ({ key: k, label: NOTIFICATION_KINDS[k].label, blurb: NOTIFICATION_KINDS[k].blurb }))}
          alertTypes={Object.entries(ALERT_TYPES).map(([key, label]) => ({ key, label }))}
        />
      </div>

      <div>
        <h3 className="mb-3 font-display text-xl uppercase text-navy-ink">Recently published</h3>
        {recent.length === 0 ? (
          <div className="card p-6 text-muted-foreground">Nothing published yet.</div>
        ) : (
          <div className="card divide-y divide-border">
            {recent.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {badgeFor(n)} · {fmtDate(n.created_at)} · {n.author_name}
                  </div>
                  <Link href={n.kind === "press" ? `/press/${n.id}` : `/notifications#n-${n.id}`} className="font-semibold text-navy-ink hover:underline">
                    {n.title}
                  </Link>
                </div>
                <div className="text-sm text-muted-foreground">
                  {n.dm_done ? `${n.dm_sent} DM${n.dm_sent === 1 ? "" : "s"} sent` : `Sending DMs… ${n.dm_sent} so far`}
                  {n.dm_failed > 0 && `, ${n.dm_failed} couldn't be delivered`}
                </div>
                <Link href={`/portal/notifications?edit=${n.id}#compose`} className="btn btn-outline !px-3 !py-1.5 text-xs">
                  <Pencil size={14} /> Edit
                </Link>
                <form action={removeNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="btn btn-outline !px-3 !py-1.5 text-xs" title="Remove from the website (DMs already sent stay sent)">
                    <Trash2 size={14} /> Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
