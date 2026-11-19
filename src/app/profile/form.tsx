"use client";

import { useActionState, useEffect, useState } from "react";
import { Bell, Megaphone, Info, Siren, Sun, Moon, Monitor, Check } from "lucide-react";
import { saveProfile } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

type Theme = "light" | "dark" | "system";
type Prefs = { dm_alerts: boolean; dm_press: boolean; dm_info: boolean; theme: Theme };

declare global {
  interface Window {
    __gspSetTheme?: (t: Theme) => void;
  }
}

function Toggle({
  name,
  checked,
  onChange,
  icon: Icon,
  title,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: typeof Bell;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 px-6 py-4 transition-colors hover:bg-panel/60">
      <Icon size={20} className="mt-0.5 shrink-0 text-navy" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-navy-ink">{title}</span>
        <span className="block text-sm text-muted-foreground">{children}</span>
      </span>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold ${
          checked ? "bg-navy" : "bg-border"
        }`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </label>
  );
}

const THEMES: { key: Theme; label: string; icon: typeof Sun; note: string }[] = [
  { key: "light", label: "Light", icon: Sun, note: "Bright and clean" },
  { key: "dark", label: "Dark", icon: Moon, note: "Easy on the eyes at night" },
  { key: "system", label: "System", icon: Monitor, note: "Match your device" },
];

function Preview({ dark }: { dark: boolean }) {
  const bg = dark ? "bg-[oklch(16.5%_0.03_262)]" : "bg-[oklch(98.5%_0.003_250)]";
  const card = dark ? "bg-[oklch(21%_0.035_262)] border-[oklch(31%_0.04_262)]" : "bg-white border-[oklch(90%_0.012_252)]";
  const line = dark ? "bg-[oklch(40%_0.03_262)]" : "bg-[oklch(88%_0.01_252)]";
  return (
    <span className={`block overflow-hidden rounded-sm border border-border ${bg}`}>
      <span className="block h-3 bg-[oklch(33%_0.13_264)]" />
      <span className="block h-[3px] bg-gold" />
      <span className={`m-2 block rounded-sm border p-2 ${card}`}>
        <span className={`block h-1.5 w-2/3 rounded ${dark ? "bg-[oklch(90%_0.01_255)]" : "bg-[oklch(25%_0.08_264)]"}`} />
        <span className={`mt-1.5 block h-1 w-full rounded ${line}`} />
        <span className={`mt-1 block h-1 w-4/5 rounded ${line}`} />
      </span>
    </span>
  );
}

export function ProfileForm({ initial, personnel }: { initial: Prefs; personnel: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveProfile, {});
  const [p, setP] = useState<Prefs>(initial);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(q.matches); // eslint-disable-line react-hooks/set-state-in-effect -- read the OS setting once
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  const kinds = personnel ? (["dm_alerts", "dm_press", "dm_info"] as const) : (["dm_alerts", "dm_press"] as const);
  const all = kinds.every((k) => p[k]);
  const set = (k: keyof Prefs, v: boolean | Theme) => setP((x) => ({ ...x, [k]: v }));

  function pickTheme(t: Theme) {
    set("theme", t);
    window.__gspSetTheme?.(t); // preview straight away; saved when they press Save
  }

  return (
    <form action={action} className="space-y-8">
      <div id="notifications" className="card scroll-mt-40 overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-2xl font-semibold uppercase text-navy-ink">Discord DMs</h2>
          <p className="mt-1 text-muted-foreground">
            Pick what the Georgia State Patrol bot sends you. Everything is also in the notification center (the bell at the
            top of every page).
          </p>
        </div>
        <div className="divide-y divide-border">
          <Toggle
            name="all"
            checked={all}
            onChange={(v) => setP((x) => ({ ...x, ...Object.fromEntries(kinds.map((k) => [k, v])) }))}
            icon={Bell}
            title="All notifications"
          >
            Turn every notification below on or off at once.
          </Toggle>
          <Toggle name="dm_alerts" checked={p.dm_alerts} onChange={(v) => set("dm_alerts", v)} icon={Siren} title="Statewide Alerts">
            Emergency releases from the Office of the Colonel — Amber, Silver and Blue (BOLO) alerts and public threats.
          </Toggle>
          <Toggle name="dm_press" checked={p.dm_press} onChange={(v) => set("dm_press", v)} icon={Megaphone} title="Press Releases">
            Less urgent updates from the Press Release Team about calls and incidents the Patrol handled.
          </Toggle>
          {personnel && (
            <Toggle name="dm_info" checked={p.dm_info} onChange={(v) => set("dm_info", v)} icon={Info} title="Important Info">
              Department-only information from High Command. Only GSP personnel receive these.
            </Toggle>
          )}
        </div>
        <p className="border-t border-border bg-panel px-6 py-3 text-xs text-muted-foreground">
          To get DMs, stay in the South Fulton Roleplay Discord and keep &ldquo;Direct Messages&rdquo; allowed in that
          server&apos;s privacy settings.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-2xl font-semibold uppercase text-navy-ink">Appearance</h2>
          <p className="mt-1 text-muted-foreground">Choose how the website looks for you.</p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = p.theme === t.key;
            const dark = t.key === "dark" || (t.key === "system" && systemDark);
            return (
              <label
                key={t.key}
                className={`relative cursor-pointer rounded-sm border-2 p-3 transition-colors ${
                  active ? "border-gold" : "border-border hover:border-navy"
                }`}
              >
                <input type="radio" name="theme" value={t.key} checked={active} onChange={() => pickTheme(t.key)} className="sr-only" />
                <Preview dark={dark} />
                <span className="mt-3 flex items-center gap-2 font-display uppercase tracking-wide text-navy-ink">
                  <t.icon size={16} className="text-navy" /> {t.label}
                </span>
                <span className="block text-sm text-muted-foreground">{t.note}</span>
                {active && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-gold-foreground">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-navy" pendingText="Saving…">
          Save settings
        </SubmitButton>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
