"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronsRight, Volume2, Volume1, VolumeX } from "lucide-react";

/**
 * The civilian introduction video, shown in a liquid-glass window the first time someone opens the site
 * in a browser session. Skip, volume and Escape close or control it. Never shown in the employee portal.
 */

const KEY = "fhp_intro_seen";
const SRC = "/videos/fhp-intro.mp4";
const POSTER = "/videos/fhp-intro-poster.jpg";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
function seen() {
  try {
    const p = window.location.pathname;
    if (p.startsWith("/portal") || p.startsWith("/dev-login") || p.startsWith("/press/")) return true;
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}
function markSeen() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* private mode — it just shows again next time */
  }
  listeners.forEach((l) => l());
}

export function IntroVideo() {
  const done = useSyncExternalStore(subscribe, seen, () => true);
  return done ? null : <IntroOverlay />;
}

function IntroOverlay() {
  const video = useRef<HTMLVideoElement>(null);
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);

  const close = () => {
    if (closing) return;
    setClosing(true);
    video.current?.pause();
    window.setTimeout(markSeen, 450);
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = 0.8;
    // Try with sound; browsers usually block that until the visitor interacts, so fall back to muted
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });

    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") document.getElementById("fhp-intro-skip")?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) {
      v.volume = 0.8;
      setVolume(0.8);
    }
    setMuted(v.muted);
  };

  const changeVolume = (value: number) => {
    const v = video.current;
    if (!v) return;
    v.volume = value;
    v.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to the Florida Highway Patrol"
      className={`intro-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-8 ${closing ? "is-closing" : ""}`}
    >
      {/* Slow-moving liquid colour behind the glass */}
      <div aria-hidden className="intro-blob intro-blob-a" />
      <div aria-hidden className="intro-blob intro-blob-b" />
      <div aria-hidden className="intro-blob intro-blob-c" />

      <div className="liquid-glass intro-panel relative w-full max-w-5xl p-2.5 sm:p-3.5">
        <div className="flex items-center justify-between px-2 pb-2.5 pt-1 sm:px-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/fhp-seal.png" alt="" className="h-7 w-7" />
            <div className="leading-tight text-white">
              <div className="font-display text-xs uppercase tracking-[0.18em] sm:text-sm">Florida Highway Patrol</div>
              <div className="hidden text-xs text-white/70 sm:block">Welcome — here&apos;s a quick look around</div>
            </div>
          </div>
          <button id="fhp-intro-skip" onClick={close} className="liquid-pill">
            Skip<span className="hidden sm:inline"> intro</span> <ChevronsRight size={16} />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-black shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
          <video
            ref={video}
            src={SRC}
            poster={POSTER}
            playsInline
            preload="auto"
            className="block aspect-video w-full"
            onEnded={close}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
          />

          {muted && (
            <button onClick={toggleMute} className="liquid-pill liquid-pill-dark absolute left-1/2 top-3 -translate-x-1/2 !py-2 sm:top-4">
              <VolumeX size={16} /> Tap for sound
            </button>
          )}

          {/* Controls */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 pb-3 pt-10 sm:px-4">
            <div className="liquid-pill liquid-pill-dark group !gap-2 !px-2.5">
              <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="flex items-center">
                <VolumeIcon size={18} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="intro-range w-20 sm:w-28"
              />
            </div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30 ring-1 ring-white/25">
              <div className="h-full rounded-full bg-gold transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
