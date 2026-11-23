import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { fetchMemberRoles } from "./discord";
import { ALL_PERMISSIONS, resolveAccess, type Permission } from "./permissions";
import { getConfig } from "./config";
import { setupAccess } from "./admins";

export const SESSION_COOKIE = "gsp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  uid: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[]; // roles at login time (fallback if live lookup fails)
  inGuild: boolean;
  /** Local preview login only: which fake role was picked. */
  dev?: string;
};

export type Viewer = SessionPayload & {
  permissions: Permission[];
  labels: string[];
  can: (p: Permission) => boolean;
};

const key = () => {
  if (!env.sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(env.sessionSecret || "dev-only-insecure-secret-change-me");
};

export async function createSessionToken(p: SessionPayload) {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Returns the logged-in user with LIVE permissions (roles re-checked against Discord every ~60s),
 * so promotions / removals in Discord take effect on the website automatically.
 */
function devAccess(as: string): { permissions: Permission[]; labels: string[] } {
  const map: Record<string, { permissions: Permission[]; labels: string[] }> = {
    public: { permissions: [], labels: [] },
    employee: { permissions: ["portal"], labels: ["Department Personnel"] },
    command: { permissions: ["portal", "applications", "content", "notices", "shifts"], labels: ["High Command"] },
    ootc: { permissions: ALL_PERMISSIONS, labels: ["Office of the Colonel"] },
    press: { permissions: ["press"], labels: ["Press Release Team"] },
    psb: { permissions: ["portal", "reports"], labels: ["Human Resources"] },
    all: { permissions: ALL_PERMISSIONS, labels: ["High Command", "Human Resources"] },
  };
  return map[as] ?? map.public;
}

export async function getViewer(): Promise<Viewer | null> {
  const s = await readSession();
  if (!s) return null;

  let roles = s.roles;
  let inGuild = s.inGuild;
  if (!s.dev) {
    try {
      const live = await fetchMemberRoles(s.uid);
      if (live === null) {
        roles = [];
        inGuild = false;
      } else if (live !== undefined) {
        roles = live;
        inGuild = true;
      }
    } catch {
      /* keep login-time roles */
    }
  }
  let access = s.dev && env.devLogin ? devAccess(s.dev) : resolveAccess(roles, await getConfig());
  if (!s.dev) {
    // The bot's owner always has full access (so a new server can be set up); server admins can open Discord Setup.
    const extra = await setupAccess(s.uid, roles);
    if (extra === "owner") access = { permissions: ALL_PERMISSIONS, labels: ["Bot Owner", ...access.labels] };
    else if (extra === "admin" && !access.permissions.includes("setup")) {
      access = { permissions: [...new Set([...access.permissions, "portal" as const, "setup" as const])], labels: [...access.labels, "Server Admin"] };
    }
  }
  const { permissions, labels } = access;
  return {
    ...s,
    roles,
    inGuild,
    permissions,
    labels,
    can: (p) => permissions.includes(p),
  };
}
