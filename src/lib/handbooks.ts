import "server-only";
import { query, queryOne } from "./db";
import { editChannelMessage, postChannelMessage } from "./discord-bot";
import { IS_COMPONENTS_V2, container, divider, section, text, type Component } from "./components";
import { env } from "./env";

/**
 * Division handbooks: one main message per channel with a button for each topic.
 * Pressing a button shows that topic privately, so the channel stays clean.
 * Edit the text here and run /handbook (or press Register commands) to update the posted messages in place.
 */

type Section = { id: string; label: string; body: string };
type Handbook = { title: string; channelId: string; logo?: string; intro: string; footer: string; sections: Section[] };

export const HANDBOOKS = {
  ia: {
    logo: "/images/divisions/ia.png",
    title: "Internal Affairs Handbook",
    channelId: "1574197986450346005",
    intro:
      "Internal Affairs protects the integrity of the Florida Highway Patrol. We investigate complaints against troopers fairly and thoroughly, and recommend action based on evidence — never on rumour or personal feelings.\n\n" +
      "Everything in this channel and every case you work is **confidential**. Use the buttons below to read each part of the handbook.",
    footer: "Internal Affairs Division · Florida Highway Patrol",
    sections: [
      {
        id: "role",
        label: "Your Role",
        body:
          "## Your Role\n" +
          "The **Internal Affairs Division** (IA) answers to the **Office of the Colonel** and works alongside **Human Resources**. Members are handpicked.\n\n" +
          "**What IA does**\n" +
          "- Reviews every complaint made against FHP personnel.\n" +
          "- Investigates misconduct and policy violations, whether reported by the public or found internally.\n" +
          "- Decides a finding for each case and recommends corrective action.\n" +
          "- Keeps accurate, complete records of every case.\n\n" +
          "**What IA does not do**\n" +
          "- Punish anyone outside the process. Discipline is only issued after a finding.\n" +
          "- Take sides. Both the complainant and the trooper get a fair, neutral investigation.\n" +
          "- Investigate cases about yourself, your friends, or anyone in your direct chain of command.",
      },
      {
        id: "intake",
        label: "Receiving Reports",
        body:
          "## Receiving Reports\n" +
          "Members of the public file complaints at **fhpvcfsrp.site/report** (Report a Trooper). Each report is posted in the Trooper Reports channel and appears in **Portal → Trooper Reports** with the status **Open**.\n\n" +
          "**A report includes**\n" +
          "- The reporter's Discord and Roblox username\n" +
          "- The trooper's name or callsign\n" +
          "- Date, location and category of the incident\n" +
          "- What happened, and any evidence links\n\n" +
          "**When a report comes in**\n" +
          "1. Claim it in the portal and set the status to **Investigating** so nobody else picks it up.\n" +
          "2. Check it isn't a duplicate of an open case.\n" +
          "3. Open the evidence links straight away, before they expire.\n" +
          "4. Contact the reporter to confirm you've received it.\n\n" +
          "Reports should be picked up within **48 hours**. Internal complaints from personnel follow the same process.",
      },
      {
        id: "investigate",
        label: "Investigations",
        body:
          "## Running an Investigation\n" +
          "1. **Review** the report and evidence. Work out exactly which policy may have been broken (SOP, Vehicle Regulations, server rules).\n" +
          "2. **Interview the complainant.** Get their account in their own words and ask for anything missing.\n" +
          "3. **Notify the trooper** that a complaint has been made, unless telling them would let them hide or destroy evidence.\n" +
          "4. **Interview the trooper** and any witnesses or other units on scene. Ask open questions and write down their answers.\n" +
          "5. **Compare** every account against the evidence and the policy.\n" +
          "6. **Record your notes** in the case in the portal as you go, so another investigator could pick it up.\n" +
          "7. **Decide the finding** and set the case status.\n\n" +
          "Interviews happen in private — a ticket or a private channel — never in public channels. Aim to finish each case within **7 days**. If it will take longer, update the notes and tell the complainant.",
      },
      {
        id: "evidence",
        label: "Evidence",
        body:
          "## Evidence Standards\n" +
          "**Strong evidence**\n" +
          "- Unedited video clips showing the whole interaction\n" +
          "- Screenshots of in-game chat, radio or Discord messages with visible timestamps\n" +
          "- Game logs and moderation records\n" +
          "- Consistent statements from more than one independent witness\n\n" +
          "**Weak evidence**\n" +
          "- Cropped or edited clips\n" +
          "- Second-hand accounts (\"someone told me…\")\n" +
          "- Statements from people with an obvious reason to take sides\n\n" +
          "**Handling evidence**\n" +
          "- Save a copy of every file — links can be deleted.\n" +
          "- Note who gave it to you and when.\n" +
          "- Never share evidence outside IA, Human Resources and the Office of the Colonel.",
      },
      {
        id: "findings",
        label: "Findings",
        body:
          "## Findings\n" +
          "Decide each case on the **balance of evidence**: is it more likely than not that the trooper broke policy?\n\n" +
          "**Case statuses in the portal**\n" +
          "- **Open** — received, not yet picked up.\n" +
          "- **Investigating** — an investigator is working it.\n" +
          "- **Sustained** — the evidence shows the trooper broke policy. Recommend corrective action.\n" +
          "- **Not Sustained** — not enough evidence that a violation happened, or the evidence shows it didn't.\n" +
          "- **Closed** — withdrawn, a duplicate, about another agency, or finished with nothing further needed.\n\n" +
          "Always tell the complainant the outcome (not the discipline given) and tell the trooper the finding. Write the reason for your finding in the case notes.",
      },
      {
        id: "discipline",
        label: "Discipline",
        body:
          "## Discipline\n" +
          "IA recommends; **Human Resources** and the **Office of the Colonel** issue. Discipline should match how serious the violation was and the trooper's record.\n\n" +
          "**Infraction types**\n" +
          "- **Warning** — minor first-time issues.\n" +
          "- **Strike** — repeated or moderate violations.\n" +
          "- **Inactivity Notice** — failing activity requirements.\n" +
          "- **Suspension** — serious misconduct; the trooper is taken off duty for a set time.\n" +
          "- **Demotion** — loss of rank for serious or repeated misconduct by a supervisor or above.\n" +
          "- **Termination** — removed from the Patrol. All department roles are taken away.\n\n" +
          "Discipline is usually progressive, but serious misconduct (abuse of power, harassment, discrimination, leaking) can go straight to suspension or termination. Every infraction gets a case number, is posted in the infractions channel and DMed to the trooper.",
      },
      {
        id: "tools",
        label: "Tools & Commands",
        body:
          "## Tools & Commands\n" +
          "**Portal → Trooper Reports** — fhpvcfsrp.site/portal/reports\n" +
          "Every complaint, its evidence, status and investigator notes. Filter by status to see your active cases.\n\n" +
          "**/infraction issue** — `user`, `type`, `reason`, optional `policy`\n" +
          "Issues an infraction (HR and Office of the Colonel only). Suspensions ask for a length.\n\n" +
          "**/infraction void** — `case_id`, optional `reason`\n" +
          "Cancels an infraction issued in error or overturned on appeal.\n\n" +
          "**Roster** — fhpvcfsrp.site/roster\n" +
          "Match names to callsigns when a report only gives a callsign.\n\n" +
          "**Department Info** — fhpvcfsrp.site/department\n" +
          "The full SOP and Vehicle Regulations to check every allegation against.",
      },
      {
        id: "conduct",
        label: "Conduct",
        body:
          "## Conduct & Confidentiality\n" +
          "- **Keep it confidential.** Never discuss a case, a complainant or evidence outside IA, Human Resources and the Office of the Colonel.\n" +
          "- **Recuse yourself** from any case involving you, a friend, or someone in your direct chain of command. Hand it to another investigator.\n" +
          "- **Stay neutral.** Treat every complainant and every trooper with the same respect.\n" +
          "- **No retaliation.** Nobody is ever punished for making a complaint in good faith.\n" +
          "- **Be accurate.** Your notes must reflect what was actually said and seen.\n" +
          "- **Hold yourself to a higher standard.** IA members are expected to set the example for the whole Patrol.\n\n" +
          "Leaking case information or abusing IA access means removal from Internal Affairs and further discipline.",
      },
    ],
  },

  canine: {
    logo: "/images/divisions/canine.png",
    title: "Canine Unit Handbook",
    channelId: "1565133881898704906",
    intro:
      "The Canine Unit puts trained K-9 teams on Florida's highways to find narcotics, track fleeing suspects and back up troopers on high-risk calls.\n\n" +
      "The unit is led by the **Canine Unit Lieutenant (314)** and **Canine Unit Sergeant (405)**. Use the buttons below to read each part of the handbook.",
    footer: "Canine Unit · Florida Highway Patrol",
    sections: [
      {
        id: "overview",
        label: "Unit Overview",
        body:
          "## Unit Overview\n" +
          "**Mission**\n" +
          "Support patrol troopers with narcotics detection, suspect tracking, area searches and — only when justified — apprehension.\n\n" +
          "**Chain of command**\n" +
          "Canine Unit Lieutenant (314) → Canine Unit Sergeant (405) → K-9 handlers.\n\n" +
          "**Membership**\n" +
          "- Handlers are selected by Canine Unit leadership.\n" +
          "- You must be off probation and in good standing with no active suspension.\n" +
          "- You keep all your normal patrol duties — K-9 is an extra responsibility, not a replacement.\n" +
          "- Leadership can remove anyone from the unit for misuse of the K-9 or repeated policy breaches.",
      },
      {
        id: "deploy",
        label: "Deployments",
        body:
          "## When to Deploy\n" +
          "**Authorized deployments**\n" +
          "- **Narcotics sniff** of a vehicle's exterior during a lawful traffic stop.\n" +
          "- **Tracking** a suspect who has fled on foot.\n" +
          "- **Area or building search** for a hidden suspect.\n" +
          "- **Apprehension** of a suspect who is violent, armed, or fleeing a serious felony.\n\n" +
          "**Never deploy**\n" +
          "- On a compliant, restrained or surrendering person.\n" +
          "- Into crowds, or where bystanders could be bitten.\n" +
          "- To scare, punish or show off.\n" +
          "- For minor traffic offences with no other reason.\n\n" +
          "Advise dispatch on the radio before every deployment with your callsign, location and the type of deployment.",
      },
      {
        id: "force",
        label: "K-9 Use of Force",
        body:
          "## K-9 Use of Force\n" +
          "A K-9 apprehension is a use of force and follows the SOP's Use of Force rules.\n\n" +
          "1. **Give a warning** before sending the dog, when it's safe to: *\"Florida Highway Patrol K-9! Come out now or the dog will be sent and you may be bitten!\"* Give them time to respond.\n" +
          "2. **Recall the dog** the moment the suspect stops resisting.\n" +
          "3. **Request medical aid** for anyone bitten.\n" +
          "4. **Notify a supervisor** straight away.\n" +
          "5. **Report it** — every apprehension is documented and reviewed by unit leadership.\n\n" +
          "Using the K-9 on someone who is already compliant is excessive force and is handled by Internal Affairs.",
      },
      {
        id: "sniffs",
        label: "Narcotics Sniffs",
        body:
          "## Narcotics Sniffs\n" +
          "- The stop must be **lawful first** — a real traffic violation or reasonable suspicion.\n" +
          "- Sniffs are done on the **outside** of the vehicle. The dog does not enter the vehicle without a separate legal reason to search.\n" +
          "- Don't hold a driver longer than the stop needs just to wait for a K-9. If you're not already nearby, the stop goes ahead without you.\n" +
          "- A **positive alert** gives probable cause to search the vehicle.\n" +
          "- A **no alert** means the dog found nothing — don't search on the sniff alone.\n" +
          "- Write down the time, the alert (or no alert) and what was found.",
      },
      {
        id: "vehicles",
        label: "Vehicles & Equipment",
        body:
          "## Vehicles & Equipment\n" +
          "- K-9 vehicles are for **Canine Unit members only**, and only while you're on duty as a handler.\n" +
          "- Follow the Vehicle Regulations on the Department Info page for livery, lights and use.\n" +
          "- Keep the dog secured in the vehicle when it isn't deployed.\n" +
          "- Don't bring the K-9 to calls that don't need it just to be seen.\n" +
          "- Report any problems with K-9 vehicles or equipment to unit leadership.",
      },
      {
        id: "reports",
        label: "Reports & Activity",
        body:
          "## Reports & Activity\n" +
          "**Log every deployment** — sniffs, tracks, searches and apprehensions — with:\n" +
          "- Your callsign and the date\n" +
          "- The type of deployment and location\n" +
          "- What happened (alert, find, arrest, bite)\n" +
          "- Other units on scene\n\n" +
          "**Activity**\n" +
          "- Meet the activity requirement set by Canine Unit leadership.\n" +
          "- Clock your time with `/shift start` and `/shift end` like any other shift.\n" +
          "- If you'll be away, file a leave of absence with `/loa` so leadership knows.",
      },
      {
        id: "conduct",
        label: "Conduct",
        body:
          "## Conduct\n" +
          "- You represent the whole Patrol with every deployment — stay professional.\n" +
          "- Follow the SOP, Vehicle Regulations and server rules at all times.\n" +
          "- Respect civilians: no deploying the dog as a joke, threat or for content.\n" +
          "- Take direction from Canine Unit leadership and field supervisors on scene.\n" +
          "- Questions or problems go to the Canine Unit Lieutenant or Sergeant.",
      },
    ],
  },

  ciu: {
    logo: "/images/divisions/ciu.png",
    title: "Criminal Interdiction Unit Handbook",
    channelId: "1565136145250132049",
    intro:
      "The Criminal Interdiction Unit (CIU) finds and stops narcotics, weapons, contraband and stolen vehicles moving along Florida's highways.\n\n" +
      "The unit is led by the **Criminal Interdiction Lieutenant (313)** and **Criminal Interdiction Unit Sergeant (404)**. Use the buttons below to read each part of the handbook.",
    footer: "Criminal Interdiction Unit · Florida Highway Patrol",
    sections: [
      {
        id: "overview",
        label: "Unit Overview",
        body:
          "## Unit Overview\n" +
          "**Mission**\n" +
          "Use lawful traffic enforcement to detect and disrupt criminal activity on the highway — drug and weapon trafficking, smuggling and stolen vehicles.\n\n" +
          "**Chain of command**\n" +
          "Criminal Interdiction Lieutenant (313) → Criminal Interdiction Unit Sergeant (404) → CIU troopers.\n\n" +
          "**Membership**\n" +
          "- Members are selected by CIU leadership.\n" +
          "- You must be off probation and in good standing with no active suspension.\n" +
          "- You keep all your normal patrol duties — interdiction is done on top of them.\n" +
          "- Leadership can remove anyone from the unit for unlawful searches or repeated policy breaches.",
      },
      {
        id: "stops",
        label: "Interdiction Stops",
        body:
          "## Interdiction Stops\n" +
          "Every interdiction starts as a **normal, lawful traffic stop**.\n\n" +
          "- You need a real reason to stop the vehicle — a traffic violation or reasonable suspicion. Never stop a car just because it \"looks suspicious\".\n" +
          "- Handle the traffic violation first: licence, registration, and the reason for the stop.\n" +
          "- While you do, watch and listen for criminal indicators.\n" +
          "- Don't drag the stop out. Once the traffic matter is finished, the driver is free to go unless you have reasonable suspicion of a crime.\n" +
          "- Call for backup before you approach a vehicle you think is high-risk.",
      },
      {
        id: "indicators",
        label: "Criminal Indicators",
        body:
          "## Criminal Indicators\n" +
          "No single indicator is proof of anything. Look for several together, and write down every one you rely on.\n\n" +
          "**The people**\n" +
          "- Nervousness that doesn't calm down, or stories that don't match between occupants\n" +
          "- Vague answers about where they're going or why\n" +
          "- Not knowing who owns the vehicle\n\n" +
          "**The vehicle**\n" +
          "- Signs of hidden compartments or tampered panels\n" +
          "- Strong masking smells such as heavy air fresheners\n" +
          "- Plates, VIN or registration that don't match the vehicle\n" +
          "- Several phones, large amounts of cash, or little luggage for a \"long trip\"",
      },
      {
        id: "searches",
        label: "Searches",
        body:
          "## Searches\n" +
          "You may only search a vehicle when one of these applies:\n" +
          "- **Consent** — freely given, and the driver can limit or withdraw it at any time. Ask clearly; don't pressure.\n" +
          "- **Probable cause** — what you saw, smelled or found gives good reason to believe there's evidence of a crime.\n" +
          "- **K-9 alert** — a positive alert from a Canine Unit sniff.\n" +
          "- **Search incident to arrest** — areas the arrested person could reach.\n" +
          "- **Inventory** — when the vehicle is lawfully impounded.\n\n" +
          "No \"fishing\" searches without one of these. An unlawful search is a policy violation and will be investigated by Internal Affairs.",
      },
      {
        id: "seizures",
        label: "Seizures & Evidence",
        body:
          "## Seizures & Evidence\n" +
          "- **Photograph** contraband where you found it before moving it.\n" +
          "- **Record** what was found, where, how much, and who was in the vehicle.\n" +
          "- Keep a clear **chain of custody** — note everyone who handled the evidence.\n" +
          "- **Stolen vehicles:** confirm with the plate and VIN, secure the occupants, then recover and impound the vehicle.\n" +
          "- **Weapons:** make them safe first, then document.\n" +
          "- Charge only what the evidence supports, and write it up before going back on patrol.",
      },
      {
        id: "teamwork",
        label: "Working With Others",
        body:
          "## Working With Other Units\n" +
          "- **Canine Unit** — request a K-9 for an exterior sniff when you have suspicion but not probable cause. Don't hold the driver unreasonably long waiting for it.\n" +
          "- **Patrol** — ask for backup for multi-occupant or high-risk stops.\n" +
          "- **Aggressive Driving Unit** — hand over street racers and reckless drivers you come across.\n" +
          "- **Supervisors** — notify a supervisor of every major seizure, pursuit or use of force.\n" +
          "- **Other agencies** — share what you find when a case crosses into their jurisdiction.",
      },
      {
        id: "conduct",
        label: "Reports & Conduct",
        body:
          "## Reports & Conduct\n" +
          "**Log every interdiction stop that leads to a search, seizure or arrest** with your callsign, date, location, the indicators you saw, the legal reason for the search and what was found.\n\n" +
          "**Activity**\n" +
          "- Meet the activity requirement set by CIU leadership.\n" +
          "- Clock your time with `/shift start` and `/shift end`.\n" +
          "- If you'll be away, file a leave of absence with `/loa`.\n\n" +
          "**Conduct**\n" +
          "- Follow the SOP, Vehicle Regulations and server rules.\n" +
          "- Treat every driver with respect — most stops find nothing, and that's fine.\n" +
          "- Never plant, invent or exaggerate evidence.\n" +
          "- Questions go to the Criminal Interdiction Lieutenant or Sergeant.",
      },
    ],
  },
} satisfies Record<string, Handbook>;

export type HandbookKey = keyof typeof HANDBOOKS;
export const HANDBOOK_PREFIX = "fhp_hb:";
const META = (key: string) => `handbook_msg_${key}`;

/* ---------------- Messages ---------------- */

function mainMessage(h: Handbook, key: string): Component[] {
  const buttons = h.sections.map((s) => ({ type: 2, style: 2, label: s.label, custom_id: `${HANDBOOK_PREFIX}${key}:${s.id}` }));
  const perRow = buttons.length > 5 ? Math.ceil(buttons.length / 2) : buttons.length;
  const rows: Component[] = [];
  for (let i = 0; i < buttons.length; i += perRow) rows.push({ type: 1, components: buttons.slice(i, i + perRow) });
  const intro = `## ${h.title}\n${h.intro}`;
  const top = h.logo ? section(intro, `${env.baseUrl}${h.logo}`) : text(intro);
  return [container([top, divider(), ...rows, divider(), text(`-# ${h.footer}`)])];
}

/** What a topic button shows (only to the person who pressed it). */
export function handbookSection(customId: string) {
  const [key, id] = customId.slice(HANDBOOK_PREFIX.length).split(":");
  const h = (HANDBOOKS as Record<string, Handbook>)[key];
  const s = h?.sections.find((x) => x.id === id);
  if (!h || !s) return { type: 4, data: { content: "That section no longer exists.", flags: 64 } };
  return {
    type: 4,
    data: {
      flags: IS_COMPONENTS_V2 | 64,
      allowed_mentions: { parse: [] },
      components: [container([text(s.body), divider(), text(`-# ${h.title} · ${h.footer}`)], false)],
    },
  };
}

/** Posts a handbook in its channel, or updates the one already posted. */
export async function postHandbook(key: HandbookKey) {
  const h = HANDBOOKS[key];
  const components = mainMessage(h, key);
  const saved = await queryOne<{ value: string }>(`SELECT value FROM meta WHERE key=$1`, [META(key)]).catch(() => null);
  if (saved?.value) {
    try {
      await editChannelMessage(h.channelId, saved.value, { components });
      return "updated";
    } catch {
      /* message was deleted — post a new one */
    }
  }
  const msg = await postChannelMessage(h.channelId, { components });
  await query(`INSERT INTO meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [META(key), msg.id]);
  return "posted";
}

/** Posts or updates every handbook. Returns a short summary. */
export async function postAllHandbooks() {
  const out: string[] = [];
  for (const key of Object.keys(HANDBOOKS) as HandbookKey[]) {
    try {
      out.push(`${HANDBOOKS[key].title}: ${await postHandbook(key)}`);
    } catch (e) {
      console.error("[handbooks] post failed", key, e);
      out.push(`${HANDBOOKS[key].title}: couldn't post (${(e as Error).message.slice(0, 120)})`);
    }
  }
  return out;
}

export const HANDBOOK_COMMANDS = [
  {
    name: "handbook",
    description: "Post or update the division handbooks (Internal Affairs, Canine, CIU) in their channels",
    type: 1,
    contexts: [0],
    default_member_permissions: String(2 ** 5), // Manage Server
  },
];
