/**
 * FHP callsign format (Updated Callsign Sheet):
 *   3## High Command · 4## Supervisory Staff · 5## Patrol Troopers · 6## Probationary Troopers · K-## K-9 units
 * Callsigns are stored as their seat number (see RANKS in roster.ts); each group counts up from x01:
 *   Colonel 1 → 301 · Lieutenant 11 → 311 · Sergeant 14 → 401 · Trooper 24 → 501 · Probationary 310 → 601
 * Change here to change it everywhere (website, nicknames, bot messages).
 */
const GROUPS = [
  { prefix: 3, first: 1, last: 15 }, // Colonel → Lieutenants (301–315)
  { prefix: 4, first: 16, last: 24 }, // Sergeants, Corporals (401–409)
  { prefix: 5, first: 31, last: 37 }, // Troopers (501–507)
  { prefix: 6, first: 310, last: 400 }, // Probationary Troopers (601+)
];

/**
 * Seat layout change (Nov 27): two more Patrol Lieutenant seats (11, 12) and two more Field Supervisory
 * Sergeant seats (17, 18). Maps a seat number from the old layout to the new one.
 */
export function migrateSeat(s: number) {
  if (s >= 11 && s <= 13) return s + 2; // Division Lieutenants: CIU, Canine, ADU
  if (s === 14) return 16; // Field Supervisory Sergeant
  if (s >= 15 && s <= 17) return s + 4; // Division Sergeants: CIU, Canine, ADU
  if (s >= 18 && s <= 20) return s + 4; // Corporals
  if (s >= 24 && s <= 30) return s + 7; // Troopers
  return s;
}

const groupOf = (n: number) => GROUPS.find((g) => n <= g.last) ?? GROUPS[GROUPS.length - 1];

export function fmtCallsign(n: number) {
  const g = groupOf(n);
  return String(g.prefix * 100 + Math.max(1, n - g.first + 1));
}

/** "401–404", or one callsign when the range is a single number. */
export const fmtCallsignRange = (lo: number, hi: number) => (lo === hi ? fmtCallsign(lo) : `${fmtCallsign(lo)}–${fmtCallsign(hi)}`);


/** Reads a typed or nickname callsign back to its seat: "311" → 11, "401" → 14, "2011" → 11, "C-07" → 7. */
export function parseCallsign(text: string): number | null {
  const t = text.trim();
  const old = /^C\s*-?\s*(\d{1,3})$/i.exec(t);
  if (old) return migrateSeat(Number(old[1]));
  const digits = t.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (digits.length === 4 && n >= 1000 && n < 5000) return migrateSeat(n % 1000); // 1###–4### format
  if (digits.length === 3) {
    const g = GROUPS.find((x) => x.prefix === Math.floor(n / 100));
    if (g && n % 100 > 0) return g.first + (n % 100) - 1;
  }
  return n;
}
