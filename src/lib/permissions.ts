import "server-only";
import { env } from "./env";

export type Permission =
  | "portal" // employee portal
  | "applications" // view + decide cadet applications
  | "reports" // Human Resources only
  | "content"; // edit command staff + divisions

export type Access = {
  permissions: Permission[];
  labels: string[]; // human readable list of matched groups
};

export function resolveAccess(roleIds: string[]): Access {
  const has = (ids: string[]) => ids.some((id) => roleIds.includes(id));
  const perms = new Set<Permission>();
  const labels: string[] = [];

  if (has(env.roles.employee)) {
    perms.add("portal");
    labels.push("Department Personnel");
  }
  if (has(env.roles.applicationReviewers)) {
    perms.add("portal");
    perms.add("applications");
    labels.push("Command");
  }
  if (has(env.roles.commandStaff)) {
    perms.add("portal");
    perms.add("applications");
    perms.add("content");
    labels.push("High Command");
  }
  // Reports are deliberately tied to the PSB role ONLY — command staff do not get this automatically.
  if (has(env.roles.psb)) {
    perms.add("portal");
    perms.add("reports");
    labels.push("Human Resources");
  }
  return { permissions: [...perms], labels };
}
