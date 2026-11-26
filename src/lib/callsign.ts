/**
 * FHP callsign format (Updated Callsign Sheet, Nov 2026):
 *   1### Office of the Colonel · 2### Supervisory Staff · 3### Patrol Supervisors · 4### Patrol Staff
 * Callsigns are stored as their seat number (1–400, see RANKS in roster.ts); the first digit comes from the tier.
 *   Colonel 1 → 1001 · Lieutenant 11 → 2011 · Sergeant 14 → 3014 · Trooper 24 → 4024 · Probationary 310 → 4310
 * Change here to change it everywhere (website, nicknames, bot messages).
 */
export function callsignTier(n: number) {
  if (n <= 3) return 1; // Colonel, Lieutenant Colonels
  if (n <= 13) return 2; // Majors, Captains, Lieutenants
  if (n <= 20) return 3; // Sergeants, Corporals
  return 4; // Troopers, Probationary Troopers
}

export const fmtCallsign = (n: number) => `${callsignTier(n)}${String(n).padStart(3, "0")}`;

/** "2011–2013", or one callsign when the range is a single number. */
export const fmtCallsignRange = (lo: number, hi: number) => (lo === hi ? fmtCallsign(lo) : `${fmtCallsign(lo)}–${fmtCallsign(hi)}`);

/** Reads a typed or nickname callsign back to its seat: "2011" → 11, "C-07" → 7, "310" → 310. */
export function parseCallsign(text: string): number | null {
  const t = text.trim();
  const old = /^C\s*-?\s*(\d{1,3})$/i.exec(t);
  if (old) return Number(old[1]);
  const digits = t.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (digits.length === 4 && n >= 1000 && n < 5000) return n % 1000;
  return n;
}
