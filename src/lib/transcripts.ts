import "server-only";
import { env } from "./env";
import { avatarUrl } from "./discord";
import { FOOTER_BANNER } from "./components";
import type { DiscordMessage } from "./discord-bot";

/** Builds a self-contained HTML transcript of a ticket channel that looks like Discord. */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Light Discord-style formatting: mentions, bold, italics, code, links, headings, quotes. */
function format(raw: string, names: Map<string, string>): string {
  let s = esc(raw);
  s = s.replace(/```(?:\w+\n)?([\s\S]*?)```/g, (_, c) => `<pre>${c.trim()}</pre>`);
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => `<span class="mention">@${esc(names.get(id) ?? id)}</span>`);
  s = s.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => `<span class="mention role">@${esc(ROLE_NAMES[id] ?? "role")}</span>`);
  s = s.replace(/&lt;#(\d+)&gt;/g, `<span class="mention">#channel</span>`);
  s = s.replace(/&lt;t:(\d+)(?::\w)?&gt;/g, (_, t) => `<span class="ts">${new Date(Number(t) * 1000).toUTCString()}</span>`);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  s = s
    .split("\n")
    .map((line) => {
      if (/^#{1,3} /.test(line)) return `<div class="h">${line.replace(/^#{1,3} /, "")}</div>`;
      if (/^-# /.test(line)) return `<div class="sub">${line.slice(3)}</div>`;
      if (/^&gt; ?/.test(line)) return `<div class="quote">${line.replace(/^&gt; ?/, "")}</div>`;
      return line;
    })
    .join("\n");
  return s.replace(/\n/g, "<br>").replace(/<\/div><br>/g, "</div>").replace(/<pre>([\s\S]*?)<\/pre>/g, (m) => m.replace(/<br>/g, "\n"));
}

/** Role names for @role mentions — filled in from the server when a transcript is built. */
let ROLE_NAMES: Record<string, string> = {};

/** Pulls the readable text out of Components V2 / embeds so bot messages show up in the transcript. */
function componentText(components: Record<string, unknown>[] | undefined): string[] {
  const out: string[] = [];
  const walk = (list: Record<string, unknown>[]) => {
    for (const c of list) {
      if (c.type === 10 && typeof c.content === "string") out.push(c.content);
      if (c.type === 2 && typeof c.label === "string") out.push(`[button: ${c.label}]`);
      if (Array.isArray(c.components)) walk(c.components as Record<string, unknown>[]);
    }
  };
  walk(components ?? []);
  return out;
}

export type TranscriptMeta = {
  ticketId: number;
  kindLabel: string;
  channelName: string;
  openerId: string;
  openerName: string;
  inquiry: string;
  claimedBy: string | null;
  closedBy: string;
  reason: string;
  openedAt: Date;
  closedAt: Date;
};

export function buildTranscript(meta: TranscriptMeta, messages: DiscordMessage[], roleNames: Record<string, string> = {}): string {
  ROLE_NAMES = roleNames;
  const names = new Map<string, string>();
  for (const m of messages) names.set(m.author.id, m.author.global_name || m.author.username);
  names.set(meta.openerId, meta.openerName);

  const fmtTime = (d: Date) =>
    d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";

  const rows = messages
    .filter((m) => m.type === 0 || m.type === 19 || m.type === 20)
    .map((m, i, arr) => {
      const prev = arr[i - 1];
      const grouped =
        prev &&
        prev.author.id === m.author.id &&
        new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime() < 5 * 60_000;
      const parts: string[] = [];
      if (m.content) parts.push(format(m.content, names));
      const v2 = componentText(m.components);
      if (v2.length) parts.push(`<div class="card">${v2.map((t) => format(t, names)).join("<br>")}</div>`);
      for (const e of m.embeds ?? []) {
        if (e.title || e.description) {
          parts.push(`<div class="card">${e.title ? `<strong>${esc(e.title)}</strong><br>` : ""}${format(e.description ?? "", names)}</div>`);
        }
      }
      for (const a of m.attachments ?? []) {
        parts.push(
          a.content_type?.startsWith("image/")
            ? `<a href="${esc(a.url)}" target="_blank"><img class="att" src="${esc(a.url)}" alt="${esc(a.filename)}"></a>`
            : `<a class="file" href="${esc(a.url)}" target="_blank">${esc(a.filename)}</a>`,
        );
      }
      if (!parts.length) parts.push(`<span class="muted">(no text)</span>`);
      const name = esc(m.author.global_name || m.author.username);
      const time = fmtTime(new Date(m.timestamp));
      return grouped
        ? `<div class="msg cont"><div class="gutter"></div><div class="body">${parts.join("")}</div></div>`
        : `<div class="msg"><img class="av" src="${esc(avatarUrl(m.author.id, m.author.avatar))}" alt="">
            <div class="body"><div class="meta"><span class="name">${name}</span>${m.author.bot ? '<span class="bot">APP</span>' : ""}<span class="time">${time}</span></div>${parts.join("")}</div></div>`;
    })
    .join("\n");

  const info: [string, string][] = [
    ["Ticket", `#${meta.ticketId} — ${meta.kindLabel}`],
    ["Channel", `#${meta.channelName}`],
    ["Opened by", `${meta.openerName} (${meta.openerId})`],
    ["Claimed by", meta.claimedBy ?? "Unclaimed"],
    ["Closed by", meta.closedBy],
    ["Reason", meta.reason],
    ["Opened", fmtTime(meta.openedAt)],
    ["Closed", fmtTime(meta.closedAt)],
    ["Messages", String(messages.length)],
  ];

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript — ${esc(meta.kindLabel)} #${meta.ticketId}</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#313338;color:#dbdee1;font:15px/1.4 "gg sans","Segoe UI",Helvetica,Arial,sans-serif}
  .wrap{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
  .banner{width:100%;border-radius:8px;display:block}.banner.footer{margin-top:40px;border-radius:6px}
  h1{font-size:22px;color:#fff;margin:18px 0 4px}.lead{color:#949ba4;margin:0 0 16px}
  .info{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;background:#2b2d31;border-radius:8px;padding:14px 16px;margin-bottom:12px}
  .info div span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#949ba4;font-weight:700}
  .inq{background:#2b2d31;border-radius:8px;padding:12px 16px;margin-bottom:24px;white-space:pre-wrap}
  .inq b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#949ba4;margin-bottom:4px}
  .msg{display:flex;gap:16px;padding:6px 0 2px;margin-top:12px}.msg.cont{margin-top:0;padding-top:1px}
  .av{width:40px;height:40px;border-radius:50%;flex:none}.gutter{width:40px;flex:none}
  .body{min-width:0;flex:1}.meta{margin-bottom:2px}.name{color:#fff;font-weight:600;margin-right:6px}
  .bot{background:#5865f2;color:#fff;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:6px;vertical-align:1px}
  .time{color:#949ba4;font-size:12px}
  .mention{background:rgba(88,101,242,.3);color:#c9cdfb;border-radius:3px;padding:0 2px}
  .card{background:#2b2d31;border:1px solid #3f4147;border-radius:8px;padding:10px 14px;margin:4px 0;max-width:640px}
  .h{color:#fff;font-weight:700;font-size:16px;margin:2px 0}.sub{color:#949ba4;font-size:12px}
  .quote{border-left:4px solid #4e5058;padding-left:10px;margin:2px 0}
  code{background:#1e1f22;border-radius:3px;padding:1px 4px;font-size:13px}
  pre{background:#1e1f22;border:1px solid #1a1b1e;border-radius:4px;padding:8px;white-space:pre-wrap;font-size:13px;margin:4px 0}
  a{color:#00a8fc;text-decoration:none}a:hover{text-decoration:underline}
  .att{max-width:400px;max-height:300px;border-radius:6px;margin-top:4px;display:block}.file{display:inline-block;margin-top:4px}
  .muted{color:#949ba4;font-style:italic}.foot{color:#949ba4;font-size:12px;text-align:center;margin-top:12px}
</style></head><body><div class="wrap">
<img class="banner" src="${esc(env.baseUrl)}/images/fhp-banner.jpg" alt="Florida Highway Patrol">
<h1>${esc(meta.kindLabel)} — Ticket #${meta.ticketId}</h1>
<p class="lead">Florida Highway Patrol • Florida State Roleplay • Transcript</p>
<div class="info">${info.map(([k, v]) => `<div><span>${k}</span>${esc(v)}</div>`).join("")}</div>
<div class="inq"><b>What's up?</b>${esc(meta.inquiry)}</div>
${rows || '<p class="muted">No messages.</p>'}${FOOTER_BANNER ? `
<img class="banner footer" src="${esc(env.baseUrl)}${FOOTER_BANNER}" alt="Florida Highway Patrol">` : ""}
<div class="foot">Generated ${esc(fmtTime(meta.closedAt))} • Florida Highway Patrol</div>
</div></body></html>`;
}
