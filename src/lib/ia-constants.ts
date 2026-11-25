/** Internal Affairs labels — shared by server pages and the case form. */

export const iaRef = (id: number) => `IA-${String(id).padStart(4, "0")}`;

export const FINDINGS = {
  open: { label: "Open", tone: "gold" },
  investigating: { label: "Investigating", tone: "navy" },
  sustained: { label: "Sustained", tone: "red" },
  not_sustained: { label: "Not Sustained", tone: "muted" },
  exonerated: { label: "Exonerated", tone: "green" },
  unfounded: { label: "Unfounded", tone: "muted" },
  closed: { label: "Closed", tone: "muted" },
} as const;
export type Finding = keyof typeof FINDINGS;
export const isFinding = (v: unknown): v is Finding => typeof v === "string" && v in FINDINGS;
export const FINDING_HELP: Record<Finding, string> = {
  open: "Received, not started.",
  investigating: "Being worked.",
  sustained: "The evidence shows the employee broke policy.",
  not_sustained: "Not enough evidence either way.",
  exonerated: "It happened, but it was within policy.",
  unfounded: "It didn't happen.",
  closed: "Withdrawn, duplicate, or no action needed.",
};

export const OUTCOMES = [
  "Pending",
  "No action",
  "Verbal counseling",
  "Warning",
  "Strike",
  "Suspension",
  "Demotion",
  "Termination",
  "Blacklist",
  "Other",
] as const;

export const CASE_CATEGORIES = [
  "Unprofessional conduct",
  "Abuse of authority",
  "Excessive force / FailRP",
  "Discrimination or harassment",
  "Improper traffic stop or arrest",
  "Rule or policy violation",
  "Internal referral",
  "Other",
];

