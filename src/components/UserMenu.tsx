import Link from "next/link";
import { connection } from "next/server";
import { LogIn, LayoutDashboard } from "lucide-react";
import { getViewer } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { badgeFor, getPrefs, listNotifications, visibleKinds } from "@/lib/notifications";
import { NotificationBell, ProfileMenu, type BellItem } from "./HeaderMenus";

async function bellData(viewer: Awaited<ReturnType<typeof getViewer>>) {
  try {
    const [rows, prefs] = await Promise.all([
      listNotifications(visibleKinds(viewer?.permissions ?? null), 20),
      viewer ? getPrefs(viewer.uid) : null,
    ]);
    const items: BellItem[] = rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      badge: badgeFor(n),
      title: n.title,
      excerpt: n.body.replace(/\s+/g, " ").slice(0, 160),
      createdAt: new Date(n.created_at).toISOString(),
    }));
    return { items, seenAt: prefs?.notif_seen_at ? new Date(prefs.notif_seen_at).toISOString() : null };
  } catch (e) {
    console.error("[notifications] bell failed", e);
    return { items: [], seenAt: null };
  }
}

export async function UserMenu() {
  await connection();
  const viewer = await getViewer();
  const bell = await bellData(viewer);
  const bellEl = (
    <NotificationBell items={bell.items} seenAt={bell.seenAt} loggedIn={!!viewer} showInfo={!!viewer?.can("portal")} />
  );

  if (!viewer) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {bellEl}
        <a href="/api/auth/login" className="btn btn-gold shrink-0 !px-3 !py-2 text-sm sm:!px-4">
          <LogIn size={16} /> <span className="hidden sm:inline">Login with Discord</span><span className="sm:hidden">Login</span>
        </a>
      </div>
    );
  }
  const publish = viewer.can("alerts") || viewer.can("press") || viewer.can("notices");
  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
      {viewer.can("portal") && (
        <Link href="/portal" className="btn btn-gold hidden !px-4 !py-2 text-sm sm:inline-flex">
          <LayoutDashboard size={16} /> Portal
        </Link>
      )}
      {bellEl}
      <ProfileMenu
        name={viewer.displayName}
        username={viewer.username}
        avatar={avatarUrl(viewer.uid, viewer.avatar)}
        labels={viewer.labels}
        portal={viewer.can("portal")}
        publish={publish}
      />
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-9 w-32 animate-pulse rounded bg-white/10" />;
}
