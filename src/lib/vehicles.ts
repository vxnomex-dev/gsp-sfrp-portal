import { RANKS, type RankKey } from "./roster";

/**
 * Vehicle regulations. Edit here — the Department Information page and its rank chart update automatically.
 *
 * minRank: the lowest rank allowed to drive / use it. Everyone at that rank and above is authorized
 * (ranks are ordered in RANKS in roster.ts, Colonel first).
 */

export type FleetVehicle = {
  key: string;
  /** Name as it appears in the ER:LC vehicle spawn menu. */
  erlc: string;
  /** Short name for the rank chart. */
  short: string;
  /** Model years to spawn, newest first. */
  years: string[];
  /** Real-world equivalent. */
  real: string;
  type: "Sedan" | "SUV";
  minRank: RankKey;
  /** Who it's for, in plain words. */
  assignment: string;
};

export const FLEET: FleetVehicle[] = [
  {
    key: "prancer",
    erlc: "Bullhorn Prancer Pursuit",
    short: "Prancer Pursuit",
    years: ["2015"],
    real: "Dodge Charger Pursuit",
    type: "Sedan",
    minRank: "prob",
    assignment: "Standard patrol car for Troopers and Corporals.",
  },
  {
    key: "falcon",
    erlc: "Falcon Interceptor Utility",
    short: "Falcon Utility",
    years: ["2024", "2020", "2019"],
    real: "Ford Explorer Interceptor Utility",
    type: "SUV",
    minRank: "prob",
    assignment: "Standard patrol SUV for Troopers and Corporals.",
  },
  {
    key: "camion",
    erlc: "Chevlon Camion PPV",
    short: "Camion PPV",
    years: ["2021"],
    real: "Chevrolet Tahoe PPV",
    type: "SUV",
    minRank: "cpl",
    assignment: "Corporals and above.",
  },
  {
    key: "pueblo",
    erlc: "Bullhorn Pueblo Pursuit",
    short: "Pueblo Pursuit",
    years: ["2022"],
    real: "Dodge Durango Pursuit",
    type: "SUV",
    minRank: "sgt",
    assignment: "Sergeants and above.",
  },
];

export type Package = {
  key: string;
  name: string;
  description: string;
  minRank: RankKey;
};

/** Lighting / livery set-ups. "Supervisory and up" = the Supervisors tier (Corporal) and above. */
export const PACKAGES: Package[] = [
  {
    key: "marked",
    name: "Marked (Lightbar)",
    description: "Standard GSP livery with the roof lightbar.",
    minRank: "prob",
  },
  {
    key: "slicktop",
    name: "Slick Top",
    description: "Standard GSP livery, no roof lightbar — visor, window and grille lights only.",
    minRank: "cpl",
  },
  {
    key: "ghost",
    name: "Ghosted",
    description: "Low-visibility ghost livery. Usually paired with a slick top.",
    minRank: "cpl",
  },
];

const ORDER = RANKS.map((r) => r.key) as RankKey[];

/** True if `rank` is at or above `min`. */
export function authorized(rank: RankKey | null, min: RankKey) {
  if (!rank) return false;
  return ORDER.indexOf(rank) <= ORDER.indexOf(min);
}

export const rankLabel = (k: RankKey) => RANKS.find((r) => r.key === k)!.label;

/** "Corporal & above", or "All troopers" when the minimum is the lowest rank. */
export function minRankText(min: RankKey) {
  return min === ORDER[ORDER.length - 1] ? "All troopers" : `${rankLabel(min)} & above`;
}
