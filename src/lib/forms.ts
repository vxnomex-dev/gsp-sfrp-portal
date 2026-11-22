import { z } from "zod";

/** Long-answer questions on the cadet application. Edit freely — the form, webhook and portal all read from this list. */
export const CADET_QUESTIONS = [
  { key: "why", label: "Why do you want to join the Florida Highway Patrol?", min: 60 },
  { key: "experience", label: "Describe any previous law enforcement roleplay experience (servers, departments, ranks).", min: 20 },
  { key: "role", label: "In your own words, what is the role of a State Trooper, and how is it different from a county deputy?", min: 60 },
  { key: "pursuit", label: "You attempt a traffic stop and the driver flees at high speed. Walk us through what you do.", min: 60 },
  { key: "misconduct", label: "You witness a fellow trooper breaking server rules on a call. How do you handle it?", min: 40 },
  { key: "extra", label: "Anything else you would like command staff to know? (optional)", min: 0 },
] as const;

export const AVAILABILITY_OPTIONS = [
  "Less than 3 hours a week",
  "3–6 hours a week",
  "6–10 hours a week",
  "10+ hours a week",
];

export const REPORT_CATEGORIES = [
  "Unprofessional conduct",
  "Abuse of authority",
  "Excessive force / FailRP",
  "Discrimination or harassment",
  "Improper traffic stop or arrest",
  "Rule or policy violation",
  "Other",
];

export const applicationSchema = z.object({
  roblox_username: z.string().trim().min(3, "Enter your Roblox username").max(20, "Roblox usernames are 20 characters max"),
  age: z.coerce.number({ message: "Enter your age" }).int().min(1, "Enter your age").max(99, "Enter a real age"),
  timezone: z.string().trim().min(2, "Enter your timezone").max(40),
  availability: z.enum(AVAILABILITY_OPTIONS as [string, ...string[]], { message: "Choose your availability" }),
  ...Object.fromEntries(
    CADET_QUESTIONS.map((q) => [
      q.key,
      q.min
        ? z.string().trim().min(q.min, `Please write at least ${q.min} characters`).max(2000, "2000 characters max")
        : z.string().trim().max(2000, "2000 characters max").optional().default(""),
    ]),
  ),
  agree: z.literal("on", { message: "You must agree before submitting" }),
});

export const reportSchema = z.object({
  reporter_roblox: z.string().trim().min(3, "Enter your Roblox username").max(20),
  trooper_name: z.string().trim().min(2, "Enter the trooper's name or description").max(80),
  trooper_identifier: z.string().trim().max(80).optional().default(""),
  incident_date: z.string().trim().min(1, "Enter the date of the incident").max(40),
  location: z.string().trim().max(120).optional().default(""),
  category: z.enum(REPORT_CATEGORIES as [string, ...string[]], { message: "Choose a category" }),
  description: z.string().trim().min(50, "Please describe what happened in at least 50 characters").max(3000, "3000 characters max"),
  evidence: z.string().trim().max(1000).optional().default(""),
  truthful: z.literal("on", { message: "You must confirm this report is truthful" }),
});

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  ref?: string;
  values?: Record<string, string>;
};

export function zodErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export const APPLICATION_STATUSES = {
  pending: { label: "Pending", tone: "gold" },
  review: { label: "Under Review", tone: "navy" },
  accepted: { label: "Accepted", tone: "green" },
  denied: { label: "Denied", tone: "red" },
} as const;

export const REPORT_STATUSES = {
  open: { label: "Open", tone: "gold" },
  investigating: { label: "Investigating", tone: "navy" },
  sustained: { label: "Sustained", tone: "red" },
  not_sustained: { label: "Not Sustained", tone: "muted" },
  closed: { label: "Closed", tone: "muted" },
} as const;

export const appRef = (id: number) => `APP-${String(id).padStart(4, "0")}`;
export const reportRef = (id: number) => `HR-${String(id).padStart(4, "0")}`;
