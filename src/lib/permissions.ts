import "server-only";
import type { DiscordConfig } from "./config";

export type Permission =
  | "portal" // employee portal
  | "applications" // view + decide cadet applications
  | "reports" // Human Resources only
  | "content" // edit command staff + divisions
  | "alerts" // publish statewide alerts (Office of the Colonel)
  | "press" // publish press releases (Press Release Team + Office of the Colonel)
  | "notices" // publish important info to department personnel (Office of the Colonel + High Command)
  | "ia" // Internal Affairs panel: cases and employee files (Internal Affairs Division + Office of the Colonel)
  | "shifts" // manage other members' shifts and leave requests (Office of the Colonel + supervisory staff)
  | "setup"; // Discord Setup: choose the server, roles and channels (bot owner, server admins, Office of the Colonel)

export const ALL_PERMISSIONS: Permission[] = ["portal", "applications", "content", "reports", "ia", "alerts", "press", "notices", "shifts", "setup"];

export type Access = {
  permissions: Permission[];
  labels: string[]; // human readable list of matched groups
};

/** What a member can do, from their Discord role IDs and the roles chosen on Portal → Discord Setup. */
export function resolveAccess(roleIds: string[], cfg: DiscordConfig): Access {
  const has = (...ids: string[]) => ids.some((id) => id && roleIds.includes(id));
  const r = cfg.roles;
  const perms = new Set<Permission>();
  const labels: string[] = [];

  if (has(r.ootc)) {
    for (const p of ALL_PERMISSIONS) perms.add(p);
    labels.push("Office of the Colonel");
  }
  if (has(r.highCommand)) {
    for (const p of ["portal", "applications", "content", "notices", "shifts"] as const) perms.add(p);
    labels.push("High Command");
  }
  if (has(r.command)) {
    perms.add("portal");
    perms.add("applications");
    perms.add("shifts");
    labels.push("Command");
  }
  // Reports are tied to Human Resources (and the Office of the Colonel) only.
  if (has(r.hr)) {
    perms.add("portal");
    perms.add("reports");
    labels.push("Human Resources");
  }
  // Internal Affairs works the reports and keeps the case files
  if (has(r.internalAffairs)) {
    perms.add("portal");
    perms.add("reports");
    perms.add("ia");
    labels.push("Internal Affairs");
  }
  if (has(r.supervisor)) perms.add("shifts");
  if (has(r.supervisor, r.patrol, r.personnel)) {
    perms.add("portal");
    if (!labels.length) labels.push("Department Personnel");
  }
  if (has(r.press)) {
    perms.add("press");
    labels.push("Press Release Team");
  }
  return { permissions: [...perms], labels };
}
