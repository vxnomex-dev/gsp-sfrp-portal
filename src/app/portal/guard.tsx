import Link from "next/link";
import { ShieldX } from "lucide-react";
import { LoginRequired } from "@/components/LoginGate";
import { getViewer, type Viewer } from "@/lib/session";
import type { Permission } from "@/lib/permissions";

type GuardResult = { viewer: Viewer; denied?: undefined } | { viewer?: undefined; denied: React.ReactNode };

const messages: Record<Permission, string> = {
  portal: "The employee portal is only available to members of the Georgia State Patrol.",
  applications: "Only command staff and application reviewers can view cadet applications.",
  reports: "Employee reports are restricted to Human Resources.",
  content: "Only command staff can edit website content.",
};

export async function guard(perm: Permission, next: string): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      denied: (
        <LoginRequired next={next} title="Employee login">
          Log in with the Discord account you use in the South Fulton Roleplay server. Your access is based on your
          Discord roles.
        </LoginRequired>
      ),
    };
  }
  if (!viewer.can(perm)) {
    return {
      denied: (
        <div className="card card-gold mx-auto max-w-xl p-8 text-center">
          <ShieldX className="mx-auto text-destructive" size={44} />
          <h2 className="mt-3 text-2xl font-semibold uppercase text-navy-ink">Access denied</h2>
          <p className="mt-3 text-muted-foreground">{messages[perm]}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            If you were recently given a role in Discord, it can take up to a minute to sync.
          </p>
          <Link href={perm === "portal" ? "/" : "/portal"} className="btn btn-outline mt-6">
            {perm === "portal" ? "Back to home" : "Back to portal"}
          </Link>
        </div>
      ),
    };
  }
  return { viewer };
}
