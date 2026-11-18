import Link from "next/link";
import { LogIn, LayoutDashboard } from "lucide-react";
import { getViewer } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";

export async function UserMenu() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <a href="/api/auth/login" className="btn btn-gold shrink-0 !px-3 !py-2 text-sm sm:!px-4">
        <LogIn size={16} /> <span className="hidden sm:inline">Login with Discord</span><span className="sm:hidden">Login</span>
      </a>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {viewer.can("portal") && (
        <Link href="/portal" className="btn btn-gold !px-4 !py-2 text-sm">
          <LayoutDashboard size={16} /> Portal
        </Link>
      )}
      <div className="hidden items-center gap-2 sm:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(viewer.uid, viewer.avatar)} alt="" className="h-9 w-9 rounded-full border-2 border-gold/70" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">{viewer.displayName}</div>
          <form action="/api/auth/logout" method="post">
            <button className="text-xs text-white/70 underline-offset-2 hover:text-white hover:underline">Log out</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-9 w-32 animate-pulse rounded bg-white/10" />;
}
