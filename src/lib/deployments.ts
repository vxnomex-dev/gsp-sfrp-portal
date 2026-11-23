import "server-only";
import { query, queryOne } from "./db";
import { getConfig, rolesFor } from "./config";
import { resolveAccess } from "./permissions";
import { postChannelMessage } from "./discord-bot";
import { IS_COMPONENTS_V2, clean, container, divider, text, unix, type Component } from "./components";

/**
 * /deployment — call a Deployment or Mass Shift.
 * Posts a Components V2 notice that pings Department Personnel, with Attending / Running Late buttons that
 * keep a live list of who's coming, and a Conclude button for the host.
 */

export const BRIEFING_VC_URL = "https://discord.com/channels/1552418272664748052/1569504113614524416";

export const DEPLOYMENT_KINDS = { deployment: "Deployment", mass_shift: "Mass Shift" } as const;
type Kind = keyof typeof DEPLOYMENT_KINDS;

export const DEP = { attend: "fhp_dep_att:", late: "fhp_dep_late:", end: "fhp_dep_end:" };

type Member = { user: { id: string }; roles: string[] };
type Deployment = {
  id: number;
  kind: Kind;
  briefing: boolean;
  host_id: string;
  cohost_id: string | null;
  starts_at: string | Date;
  server_code: string | null;
  notes: string | null;
  channel_id: string | null;
  message_id: string | null;
  status: "active" | "concluded";
  ended_by: string | null;
  ended_at: string | Date | null;
  created_at: string | Date;
};
type Attendee = { user_id: string; status: "attending" | "late" };

const reply = (content: string) => ({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });

async function canHost(m: Member) {
  const ids = rolesFor(await getConfig(), "ootc", "supervisor");
  return m.roles.some((r) => ids.includes(r));
}
async function isPersonnel(m: Member) {
  return resolveAccess(m.roles, await getConfig()).permissions.includes("portal");
}

const fmtDuration = (ms: number) => {
  const mins = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
};

/** Mentions, trimmed so the message stays inside Discord's limits. */
function list(ids: string[], max = 60) {
  if (!ids.length) return "_No one yet_";
  const shown = ids.slice(0, max).map((id) => `<@${id}>`);
  return shown.join(" ") + (ids.length > max ? ` and **${ids.length - max} more**` : "");
}

function render(d: Deployment, attendees: Attendee[], personnelRole: string | null): Component[] {
  const label = DEPLOYMENT_KINDS[d.kind];
  const live = d.status === "active";
  const starts = unix(new Date(d.starts_at));
  const going = attendees.filter((a) => a.status === "attending").map((a) => a.user_id);
  const late = attendees.filter((a) => a.status === "late").map((a) => a.user_id);

  const details = [
    `**Host:** <@${d.host_id}>`,
    d.cohost_id ? `**Co-Host:** <@${d.cohost_id}>` : null,
    live
      ? `**Starts:** ${starts - unix(new Date(d.created_at)) < 60 ? "Now" : `<t:${starts}:t> (<t:${starts}:R>)`}`
      : `**Started:** <t:${starts}:t>`,
    d.briefing
      ? `**Briefing:** Yes — report to the **Briefing VC** before going on duty.`
      : `**Briefing:** No — go straight on duty when it starts.`,
    d.server_code ? `**Server Code:** \`${clean(d.server_code, 40)}\`` : null,
    d.notes ? `**Notes:** ${clean(d.notes, 600)}` : null,
  ].filter(Boolean);

  const header = live
    ? `## ${label}\n` +
      (personnelRole ? `<@&${personnelRole}>\n` : "") +
      `> A **${label}** is being hosted by <@${d.host_id}>. All available personnel are asked to attend` +
      (d.briefing ? " — briefing first." : ".")
    : `## ${label} — Concluded\n` +
      `> This ${label.toLowerCase()} was concluded by <@${d.ended_by}> <t:${unix(new Date(d.ended_at!))}:R>` +
      ` after **${fmtDuration(new Date(d.ended_at!).getTime() - new Date(d.starts_at).getTime())}**, with **${going.length + late.length}** personnel.`;

  const rows: Component[] = [];
  if (live) {
    rows.push({
      type: 1,
      components: [
        { type: 2, style: 3, label: `Attending (${going.length})`, custom_id: `${DEP.attend}${d.id}` },
        { type: 2, style: 2, label: `Running Late (${late.length})`, custom_id: `${DEP.late}${d.id}` },
        ...(d.briefing ? [{ type: 2, style: 5, label: "Briefing VC", url: BRIEFING_VC_URL }] : []),
        { type: 2, style: 4, label: "Conclude", custom_id: `${DEP.end}${d.id}` },
      ],
    });
  }

  return [
    container([
      text(header),
      divider(),
      text(details.join("\n")),
      divider(),
      text(`### Attending (${going.length})\n${list(going)}` + (late.length ? `\n### Running Late (${late.length})\n${list(late, 30)}` : "")),
      ...rows,
      text(
        live
          ? `-# ${label} #${d.id} · Press **Attending** or **Running Late** to sign up — press it again to remove yourself.`
          : `-# ${label} #${d.id} · Thank you to everyone who attended.`,
      ),
    ]),
  ];
}

const getDeployment = (id: number) => queryOne<Deployment>(`SELECT * FROM deployments WHERE id=$1`, [id]);
const getAttendees = (id: number) =>
  query<Attendee>(`SELECT user_id, status FROM deployment_attendees WHERE deployment_id=$1 ORDER BY responded_at, user_id`, [id]);

/* ---------------- /deployment ---------------- */

export async function startDeployment(opts: {
  member: Member;
  channelId: string;
  kind: string;
  briefing: boolean;
  startsIn: number;
  cohost: string | null;
  serverCode: string | null;
  notes: string | null;
}) {
  const { member } = opts;
  if (!(await canHost(member))) return reply("Only the Office of the Colonel and Supervisory Staff can host a deployment.");
  const kind: Kind = opts.kind === "mass_shift" ? "mass_shift" : "deployment";
  const cfg = await getConfig();
  const channelId = cfg.channels.deployments || opts.channelId;
  const personnelRole = cfg.roles.personnel || null;
  const startsAt = new Date(Date.now() + Math.max(0, Math.min(opts.startsIn, 1440)) * 60_000);

  const d = (await queryOne<Deployment>(
    `INSERT INTO deployments (kind, briefing, host_id, cohost_id, starts_at, server_code, notes, channel_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [kind, opts.briefing, member.user.id, opts.cohost, startsAt, opts.serverCode?.trim() || null, opts.notes?.trim() || null, channelId],
  ))!;
  // The host is attending, of course
  await query(`INSERT INTO deployment_attendees (deployment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [d.id, member.user.id]);

  try {
    const msg = await postChannelMessage(channelId, {
      components: render(d, await getAttendees(d.id), personnelRole),
      allowed_mentions: { parse: [], roles: personnelRole ? [personnelRole] : [] },
    });
    await query(`UPDATE deployments SET message_id=$1, channel_id=$2 WHERE id=$3`, [msg.id, msg.channel_id, d.id]);
    return reply(`${DEPLOYMENT_KINDS[kind]} #${d.id} posted in <#${msg.channel_id}>.`);
  } catch (e) {
    console.error("[deployment] post failed", e);
    await query(`DELETE FROM deployments WHERE id=$1`, [d.id]);
    return reply("I couldn't post there — make sure I can View Channel and Send Messages in that channel.");
  }
}

/* ---------------- Buttons ---------------- */

/** Attending / Running Late / Conclude. Returns an interaction response (update the message, or a private note). */
export async function deploymentButton(customId: string, member: Member) {
  const prefix = Object.values(DEP).find((p) => customId.startsWith(p))!;
  const id = Number(customId.slice(prefix.length));
  const d = await getDeployment(id);
  if (!d) return reply("This deployment no longer exists.");
  if (d.status !== "active") return reply("This deployment has already concluded.");

  if (prefix === DEP.end) {
    const allowed = member.user.id === d.host_id || member.user.id === d.cohost_id || (await canHost(member));
    if (!allowed) return reply("Only the host, co-host, Supervisory Staff or the Office of the Colonel can conclude this.");
    await query(`UPDATE deployments SET status='concluded', ended_by=$1, ended_at=now() WHERE id=$2 AND status='active'`, [member.user.id, id]);
  } else {
    if (!(await isPersonnel(member))) return reply("Only Florida Highway Patrol personnel can sign up.");
    const status = prefix === DEP.late ? "late" : "attending";
    const removed = await queryOne(
      `DELETE FROM deployment_attendees WHERE deployment_id=$1 AND user_id=$2 AND status=$3 RETURNING user_id`,
      [id, member.user.id, status],
    );
    if (!removed) {
      await query(
        `INSERT INTO deployment_attendees (deployment_id, user_id, status) VALUES ($1,$2,$3)
         ON CONFLICT (deployment_id, user_id) DO UPDATE SET status=EXCLUDED.status, responded_at=now()`,
        [id, member.user.id, status],
      );
    }
  }

  const [fresh, attendees, cfg] = await Promise.all([getDeployment(id), getAttendees(id), getConfig()]);
  return {
    type: 7, // update the message the button is on
    data: { flags: IS_COMPONENTS_V2, components: render(fresh!, attendees, cfg.roles.personnel || null), allowed_mentions: { parse: [] } },
  };
}

export const DEPLOYMENT_COMMANDS = [
  {
    name: "deployment",
    description: "Call a Deployment or Mass Shift and ping Department Personnel",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 3,
        name: "type",
        description: "Deployment or Mass Shift",
        required: true,
        choices: Object.entries(DEPLOYMENT_KINDS).map(([value, name]) => ({ name, value })),
      },
      { type: 5, name: "briefing", description: "Is there a briefing first? (sends everyone to the Briefing VC)", required: true },
      { type: 4, name: "starts_in", description: "Minutes until it starts (leave empty for now)", required: false, min_value: 0, max_value: 1440 },
      { type: 6, name: "cohost", description: "Co-host (optional)", required: false },
      { type: 3, name: "server_code", description: "In-game server code (optional)", required: false, max_length: 40 },
      { type: 3, name: "notes", description: "Anything else — uniform, patrol area, focus (optional)", required: false, max_length: 600 },
    ],
  },
];
