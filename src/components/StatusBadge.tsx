import { APPLICATION_STATUSES, REPORT_STATUSES } from "@/lib/forms";
import { FINDINGS } from "@/lib/ia-constants";

const tones = {
  gold: "bg-gold/25 text-[oklch(40%_0.1_70)] border-gold/60",
  navy: "bg-navy/10 text-navy border-navy/30",
  green: "bg-[oklch(93%_0.06_155)] text-[oklch(38%_0.11_155)] border-[oklch(75%_0.1_155)]",
  red: "bg-[oklch(94%_0.04_27)] text-[oklch(45%_0.17_27)] border-[oklch(78%_0.1_27)]",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ kind, status }: { kind: "application" | "report" | "ia"; status: string }) {
  const map = (kind === "application" ? APPLICATION_STATUSES : kind === "ia" ? FINDINGS : REPORT_STATUSES) as Record<string, { label: string; tone: keyof typeof tones }>;
  const s = map[status] ?? { label: status, tone: "muted" as const };
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 font-display text-xs uppercase tracking-wider ${tones[s.tone]}`}>
      {s.label}
    </span>
  );
}
