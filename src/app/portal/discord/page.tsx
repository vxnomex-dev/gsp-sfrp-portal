import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, CheckCircle2, CircleDashed, Server } from "lucide-react";
import { guard } from "../guard";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { CHANNEL_SLOTS, ROLE_SLOTS, getConfig } from "@/lib/config";
import { fetchChannelsOf, fetchRolesOf, listBotGuilds, type BotGuild } from "@/lib/discord-bot";
import { RegisterCommands } from "./RegisterCommands";
import { ServerPicker, SetupForm } from "./forms";

export const metadata = { title: "Discord Setup" };

export default function DiscordSetupPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-panel" />}>
      <DiscordSetup />
    </Suspense>
  );
}

const guildIcon = (g: BotGuild) => (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null);

// Send Messages, Embed Links, Attach Files, Read History, View Channels, Manage Channels, Manage Roles,
// Manage Nicknames, Create Public Threads, Send Messages in Threads, Manage Threads
const BOT_PERMISSIONS = "395137100816";

async function DiscordSetup() {
  const g = await guard("setup", "/portal/discord");
  if (!g.viewer) return g.denied;
  const cfg = await getConfig();

  let guilds: BotGuild[] = [];
  let error: string | null = null;
  try {
    guilds = await listBotGuilds();
  } catch (e) {
    error = (e as Error).message;
  }

  let roles: { id: string; name: string }[] = [];
  let channels: { id: string; name: string; category: boolean; parent: string }[] = [];
  if (cfg.guildId) {
    try {
      const [r, c] = await Promise.all([fetchRolesOf(cfg.guildId), fetchChannelsOf(cfg.guildId)]);
      roles = r
        .filter((x) => x.id !== cfg.guildId && !x.managed)
        .sort((a, b) => b.position - a.position)
        .map((x) => ({ id: x.id, name: x.name }));
      const cats = new Map(c.filter((x) => x.type === 4).map((x) => [x.id, x.name]));
      channels = c
        .filter((x) => [0, 4, 5].includes(x.type))
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ id: x.id, name: x.name, category: x.type === 4, parent: (x.parent_id && cats.get(x.parent_id)) || "" }));
    } catch (e) {
      error = (e as Error).message;
    }
  }

  const total = Object.keys(ROLE_SLOTS).length + Object.keys(CHANNEL_SLOTS).length;
  const done = [...Object.values(cfg.roles), ...Object.values(cfg.channels)].filter(Boolean).length;
  const invite = `https://discord.com/oauth2/authorize?client_id=${env.discord.clientId}&scope=bot%20applications.commands&permissions=${BOT_PERMISSIONS}`;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
          <ChevronLeft size={16} /> Portal
        </Link>
        <h2 className="text-3xl font-semibold uppercase text-navy-ink">Discord Setup</h2>
        <p className="mt-1 text-muted-foreground">
          Choose the server the {site.shortName} bot works in, then which roles and channels do what. Nothing needs to be
          changed in code when you move servers.
        </p>
      </div>

      {error && (
        <div className="border-l-4 border-destructive bg-card px-5 py-4 text-sm">
          Couldn&apos;t reach Discord: {error}
        </div>
      )}

      {/* 1. Server */}
      <div className="card card-gold space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl uppercase text-navy-ink">1. Server</h3>
          {cfg.guildId ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 size={16} /> Working in <strong>{cfg.guildName || cfg.guildId}</strong>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
              <CircleDashed size={16} /> No server chosen
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          Servers the bot is in. Use one, or make the bot leave servers it shouldn&apos;t be in. Not listed?{" "}
          <a className="text-navy underline" href={invite} target="_blank" rel="noreferrer">
            Invite the bot
          </a>{" "}
          first.
        </p>
        {guilds.length === 0 && !error && <p className="text-sm text-muted-foreground">The bot isn&apos;t in any servers.</p>}
        <div className="divide-y divide-border rounded-sm border border-border">
          {guilds.map((gd) => (
            <ServerPicker
              key={gd.id}
              guild={{ id: gd.id, name: gd.name, icon: guildIcon(gd) }}
              current={gd.id === cfg.guildId}
              fallbackIcon={<Server size={20} className="text-navy" />}
            />
          ))}
        </div>
      </div>

      {/* 2. Roles & channels */}
      {cfg.guildId && (
        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl uppercase text-navy-ink">2. Roles &amp; channels</h3>
            <span className="text-sm text-muted-foreground">
              {done} of {total} set
            </span>
          </div>
          <p className="text-muted-foreground">
            Pick what each one is in <strong>{cfg.guildName}</strong>. Website access and every bot feature follows these.
          </p>
          <SetupForm
            key={JSON.stringify([cfg.roles, cfg.channels])}
            roleSlots={Object.entries(ROLE_SLOTS).map(([key, v]) => ({ key, ...v }))}
            channelSlots={Object.entries(CHANNEL_SLOTS).map(([key, v]) => ({ key, ...v }))}
            roles={roles}
            channels={channels}
            values={{ roles: cfg.roles, channels: cfg.channels }}
          />
        </div>
      )}

      {/* 3. Commands */}
      {cfg.guildId && (
        <div className="card space-y-4 p-6">
          <h3 className="font-display text-xl uppercase text-navy-ink">3. Register slash commands</h3>
          <p className="text-muted-foreground">
            Adds <code>/claim</code>, <code>/close</code>, <code>/close-request</code>, <code>/rename</code>,{" "}
            <code>/support-panel</code>, <code>/promote</code> and <code>/infraction</code> to {cfg.guildName}. Run it
            after choosing a server, and again whenever commands change. Safe to click more than once.
          </p>
          <RegisterCommands />
        </div>
      )}

      {cfg.guildId && (
        <div className="card space-y-2 p-6">
          <h3 className="font-display text-xl uppercase text-navy-ink">4. Post the support panel</h3>
          <p className="text-muted-foreground">
            In Discord, go to the channel where the panel should live and type <code>/support-panel</code>. Only members
            with the Manage Server permission can use it.
          </p>
        </div>
      )}
    </div>
  );
}
