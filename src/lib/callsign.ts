/** Callsign format: "C-07". Change here to change it everywhere (website, nicknames, bot messages). */
export const fmtCallsign = (n: number) => `C-${String(n).padStart(2, "0")}`;

/** "C-07–C-12", or one callsign when the range is a single number. */
export const fmtCallsignRange = (lo: number, hi: number) => (lo === hi ? fmtCallsign(lo) : `${fmtCallsign(lo)}–${fmtCallsign(hi)}`);
