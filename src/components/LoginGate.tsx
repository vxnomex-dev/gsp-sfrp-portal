import { LogIn } from "lucide-react";

export function LoginRequired({ next, title, children }: { next: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card card-gold mx-auto max-w-xl p-8 text-center">
      <h2 className="text-2xl font-semibold uppercase text-navy-ink">{title}</h2>
      <p className="mt-3 text-muted-foreground">{children}</p>
      <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} className="btn btn-navy mt-6">
        <LogIn size={18} /> Login with Discord
      </a>
      <p className="mt-4 text-xs text-muted-foreground">
        We only receive your Discord username, ID and avatar. We never see your password or messages.
      </p>
    </div>
  );
}
