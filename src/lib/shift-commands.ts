import "server-only";
import { getConfig } from "./config";
import { resolveAccess } from "./permissions";
import { fetchGuildMember } from "./discord-bot";
import { activeShift, endShift, fmtDuration, managerScope, rosterWithShifts, startShift, totalSeconds } from "./shifts";
import { LOA_DENY_INPUT, createLoa, decideLoa, endExpiredLoas, getLoa, loaDenyModal } from "./loa";
import { rankForRoles } from "./roster";
import { privateReply, type Member } from "./tickets";

export const LOA_FORM_MODAL = "fhp_loa_form";

const nameOf = (m: Member) => m.nick || m.user.global_name || m.user.username;

async function access(m: Member) {
  return resolveAccess(m.roles, await getConfig());
}

/** /shift start | end | status */
export async function shiftCommand(member: Member, sub: string, targetId: string | null) {
  const acc = await access(member);
  if (!acc.permissions.includes("portal")) return privateReply("Only department personnel can use shifts.");
  const me = member.user.id;

  if (sub === "start") {
    const r = await startShift(me, nameOf(member));
    return privateReply(r.ok ? "You're now **on duty**. Use `/shift end` when you're done." : r.message);
  }
  if (sub === "end") {
    const r = await endShift(me);
    if (!r.ok) return privateReply("You're not on duty.");
    return privateReply(`You're now **off duty**. That shift was **${r.length}**. Total: **${fmtDuration(await totalSeconds(me))}**.`);
  }
  if (sub === "status") {
    const who = targetId ?? me;
    if (who !== me && !acc.permissions.includes("shifts")) return privateReply("You can only check your own shift.");
    const [active, total] = await Promise.all([activeShift(who), totalSeconds(who)]);
    const subject = who === me ? "You're" : `<@${who}> is`;
    return privateReply(
      (active
        ? `${subject} **on duty** since <t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:t> (<t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>).`
        : `${subject} **off duty**.`) + `\nTotal shift time: **${fmtDuration(total)}**.`,
    );
  }
  if (sub === "leaderboard") {
    const board = (await rosterWithShifts()).filter((m) => m.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
    if (!board.length) return privateReply("No shift time logged since the last wipe yet.");
    return privateReply(
      "**Shift leaderboard** (since the last wipe)\n" +
        board
          .map((m, i) => `**${i + 1}.** ${m.callsignLabel ? `${m.callsignLabel} ` : ""}<@${m.userId}> — ${fmtDuration(m.total)}${m.activeSince ? " (on duty)" : ""}`)
          .join("\n"),
    );
  }
  if (sub === "force-end") {
    if (!targetId) return privateReply("Pick a member.");
    const scope = await managerScope({ uid: me, roles: member.roles, can: (p) => acc.permissions.includes(p) });
    if (!scope) return privateReply("Only the Office of the Colonel and supervisory staff can end other people's shifts.");
    const target = await fetchGuildMember(targetId).catch(() => null);
    if (!target) return privateReply("That member isn't in the server.");
    if (!scope.canManage({ userId: targetId, rank: await rankForRoles(target.roles) })) {
      return privateReply("You can only manage shifts of members ranked below you.");
    }
    const r = await endShift(targetId, { id: me, name: nameOf(member) });
    return privateReply(r.ok ? `Ended <@${targetId}>'s shift (${r.length}).` : `<@${targetId}> isn't on duty.`);
  }
  return privateReply("Unknown subcommand.");
}

/** /loa → the request form */
export function loaFormModal() {
  const input = (id: string, label: string, placeholder: string, style = 1, max = 10) => ({
    type: 1,
    components: [{ type: 4, custom_id: id, label, style, required: true, max_length: max, placeholder }],
  });
  return {
    type: 9,
    data: {
      custom_id: LOA_FORM_MODAL,
      title: "Leave of Absence request",
      components: [
        input("start", "First day of leave (MM/DD/YYYY)", "11/24/2026"),
        input("end", "Last day of leave (MM/DD/YYYY)", "12/01/2026"),
        input("reason", "Reason", "Why do you need the leave?", 2, 1000),
      ],
    },
  };
}

/** "11/24/2026", "2026-11-24", "11/24" (this year) → "2026-11-24" */
export function parseDay(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s))) {
    m = Number(mt[1]);
    d = Number(mt[2]);
    y = mt[3] ? Number(mt[3].length === 2 ? `20${mt[3]}` : mt[3]) : new Date().getFullYear();
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function validateLoa(start: string | null, end: string | null, reason: string) {
  if (!start) return "Enter the first day as MM/DD/YYYY.";
  if (!end) return "Enter the last day as MM/DD/YYYY.";
  if (end < start) return "The last day can't be before the first day.";
  const today = new Date().toISOString().slice(0, 10);
  if (end < today) return "That leave is already over.";
  if ((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000 > 90) return "Leave can't be longer than 90 days.";
  if (reason.trim().length < 5) return "Please give a reason.";
  return null;
}

export async function submitLoaFromDiscord(member: Member, startRaw: string, endRaw: string, reason: string) {
  const acc = await access(member);
  if (!acc.permissions.includes("portal")) return "Only department personnel can request leave.";
  const start = parseDay(startRaw);
  const end = parseDay(endRaw);
  const err = validateLoa(start, end, reason);
  if (err) return err;
  const r = await createLoa({ id: member.user.id, name: nameOf(member) }, start!, end!, reason.trim().slice(0, 1000));
  return r.posted
    ? `Your leave request (ID: ${r.loa.id}) was sent to supervisors. You'll get a DM when it's decided.`
    : `Your leave request (ID: ${r.loa.id}) was saved, but couldn't be posted to Discord — let a supervisor know.`;
}

/** Approve / Deny buttons on an LOA request. Returns an error message, or null when allowed. */
export async function checkLoaDecider(member: Member, loaId: number) {
  const acc = await access(member);
  const scope = await managerScope({ uid: member.user.id, roles: member.roles, can: (p) => acc.permissions.includes(p) });
  if (!scope) return "Only the Office of the Colonel and supervisory staff can decide leave requests.";
  const l = await getLoa(loaId);
  if (!l) return "That request no longer exists.";
  if (l.status !== "pending") return `That request was already ${l.status}.`;
  const target = await fetchGuildMember(l.user_id).catch(() => null);
  if (!scope.canManage({ userId: l.user_id, rank: target ? await rankForRoles(target.roles) : null })) {
    return "You can only decide leave for members ranked below you.";
  }
  return null;
}

export async function decideLoaFromDiscord(member: Member, loaId: number, status: "approved" | "denied", reason: string | null) {
  await endExpiredLoas().catch(() => {});
  return decideLoa(loaId, status, { id: member.user.id, name: nameOf(member) }, reason);
}

export { LOA_DENY_INPUT, loaDenyModal };

export const SHIFT_COMMANDS = [
  {
    name: "shift",
    description: "Go on or off duty and check shift time",
    type: 1,
    contexts: [0],
    options: [
      { type: 1, name: "start", description: "Go on duty" },
      { type: 1, name: "end", description: "Go off duty" },
      {
        type: 1,
        name: "status",
        description: "Your shift status and total time",
        options: [{ type: 6, name: "user", description: "Check someone else (supervisors only)", required: false }],
      },
      { type: 1, name: "leaderboard", description: "Top 10 by shift time since the last wipe" },
      {
        type: 1,
        name: "force-end",
        description: "End someone's shift (supervisory staff, members below you)",
        options: [{ type: 6, name: "user", description: "Whose shift to end", required: true }],
      },
    ],
  },
  { name: "loa", description: "Request a leave of absence", type: 1, contexts: [0] },
];
