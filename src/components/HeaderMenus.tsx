"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Megaphone, Settings, UserRound } from "lucide-react";
import { markNotificationsSeen } from "@/app/actions";

export type BellItem = {
  id: number;
  kind: "alert" | "press" | "info";
  badge: string;
  title: string;
  excerpt: string;
  createdAt: string;
};

const SEEN_KEY = "gsp_notif_seen";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const TABS = [
  { key: "all", label: "All" },
  { key: "alert", label: "Alerts" },
  { key: "press", label: "Press" },
  { key: "info", label: "Info" },
] as const;

export function NotificationBell({
  items,
  seenAt,
  loggedIn,
  showInfo,
}: {
  items: BellItem[];
  seenAt: string | null;
  loggedIn: boolean;
  showInfo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  // When they last opened the bell (server for logged-in users, this browser otherwise)
  const [seen, setSeen] = useState<number | null>(seenAt ? new Date(seenAt).getTime() : loggedIn ? 0 : null);
  // Counted after the page loads so the server and browser render the same thing
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read the clock / this browser once */
    setNow(Date.now());
    if (!loggedIn) setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loggedIn]);

  const cutoff = now === null ? Infinity : Math.max(seen ?? now, now - WEEK);
  const unread = now === null || seen === null ? 0 : items.filter((i) => new Date(i.createdAt).getTime() > cutoff).length;
  // Gold dots mark what was new when the panel was opened
  const [dotsFrom, setDotsFrom] = useState<number | null>(null);
  const isNew = (i: BellItem) => dotsFrom !== null && new Date(i.createdAt).getTime() > dotsFrom;
  const ref = useClickAway(open, () => setOpen(false));
  const shown = useMemo(() => (tab === "all" ? items : items.filter((i) => i.kind === tab)), [items, tab]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setDotsFrom(cutoff);
      if (unread > 0) {
        const t = Date.now();
        setSeen(t);
        setNow(t);
        if (loggedIn) markNotificationsSeen().catch(() => {});
        else localStorage.setItem(SEEN_KEY, String(t));
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications (${unread} new)` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <Bell size={21} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 font-display text-[0.7rem] leading-none text-gold-foreground ring-2 ring-navy">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[5.5rem] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[25rem]">
          <div className="card overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-white">
              <div className="font-display text-lg uppercase tracking-wide">Notifications</div>
              <Link href="/profile#notifications" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs text-white/75 hover:text-gold">
                <Settings size={14} /> DM settings
              </Link>
            </div>
            <div className="flex gap-1 border-b border-border px-3 py-2">
              {TABS.filter((t) => t.key !== "info" || showInfo).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-sm px-2.5 py-1 font-display text-xs uppercase tracking-wider ${
                    tab === t.key ? "bg-navy text-white" : "text-muted-foreground hover:bg-panel"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <ul className="max-h-[min(28rem,65vh)] divide-y divide-border overflow-y-auto">
              {shown.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 opacity-40" size={26} />
                  You&apos;re all caught up.
                </li>
              )}
              {shown.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/notifications#n-${i.id}`}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-panel"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew(i) ? "bg-gold" : "bg-transparent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`font-display text-[0.7rem] uppercase tracking-[0.14em] ${
                            i.kind === "alert" ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {i.badge}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground" suppressHydrationWarning>
                          {timeAgo(i.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block font-semibold leading-snug text-navy-ink">{i.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{i.excerpt}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-border bg-panel px-4 py-2.5 text-center font-display text-sm uppercase tracking-wide text-navy hover:text-navy-ink"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileMenu({
  name,
  username,
  avatar,
  labels,
  portal,
  publish,
}: {
  name: string;
  username: string;
  avatar: string;
  labels: string[];
  portal: boolean;
  publish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const item = "flex items-center gap-3 px-4 py-2.5 text-[0.95rem] text-foreground transition-colors hover:bg-panel";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Profile menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-white transition-colors hover:bg-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className="h-9 w-9 rounded-full border-2 border-gold/70" />
        <span className="hidden max-w-36 truncate text-sm font-semibold lg:inline">{name}</span>
        <ChevronDown size={16} className={`hidden transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72">
          <div className="card overflow-hidden shadow-xl">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className="h-11 w-11 rounded-full border-2 border-gold" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-navy-ink">{name}</div>
                <div className="truncate text-sm text-muted-foreground">@{username}</div>
              </div>
            </div>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3">
                {labels.map((l) => (
                  <span key={l} className="rounded-sm bg-navy px-1.5 py-0.5 font-display text-[0.65rem] uppercase tracking-wider text-white">
                    {l}
                  </span>
                ))}
              </div>
            )}
            <nav className="py-1" onClick={() => setOpen(false)}>
              <Link href="/profile" className={item}>
                <UserRound size={17} className="text-navy" /> Profile &amp; Settings
              </Link>
              <Link href="/notifications" className={item}>
                <Bell size={17} className="text-navy" /> Notifications
              </Link>
              {portal && (
                <Link href="/portal" className={item}>
                  <LayoutDashboard size={17} className="text-navy" /> Employee Portal
                </Link>
              )}
              {publish && (
                <Link href="/portal/notifications" className={item}>
                  <Megaphone size={17} className="text-navy" /> Publish a Release
                </Link>
              )}
            </nav>
            <form action="/api/auth/logout" method="post" className="border-t border-border py-1">
              <button className={`${item} w-full text-left`}>
                <LogOut size={17} className="text-navy" /> Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
