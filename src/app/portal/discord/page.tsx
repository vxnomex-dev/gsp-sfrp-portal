import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { guard } from "../guard";
import { RegisterCommands } from "./RegisterCommands";

export default function DiscordBotPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <DiscordBot />
    </Suspense>
  );
}

async function DiscordBot() {
  const g = await guard("content", "/portal/discord");
  if (!g.viewer) return g.denied;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Discord Bot</h2>
        <p className="mt-1 text-muted-foreground">Set up the support ticket system in the South Fulton Roleplay server.</p>
      </div>
      <div className="card card-gold space-y-4 p-6">
        <h3 className="font-display text-xl uppercase text-navy-ink">1. Register slash commands</h3>
        <p className="text-muted-foreground">
          Adds <code>/claim</code>, <code>/close</code>, <code>/close-request</code>, <code>/rename</code> and <code>/support-panel</code> to the server.
          Run this once (and again if commands are ever changed). It&apos;s safe to click more than once.
        </p>
        <RegisterCommands />
      </div>
      <div className="card space-y-2 p-6">
        <h3 className="font-display text-xl uppercase text-navy-ink">2. Post the support panel</h3>
        <p className="text-muted-foreground">
          In Discord, go to the channel where the panel should live and type <code>/support-panel</code>. Only members with
          the Manage Server permission can use it.
        </p>
      </div>
    </div>
  );
}
