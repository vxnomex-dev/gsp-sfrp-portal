import "server-only";
import { query, queryOne } from "./db";

export type Nda = {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  roblox: string | null;
  signature: string;
  signed_at: string | Date;
  status: "pending" | "countersigned" | "void";
  rep_id: string | null;
  rep_name: string | null;
  rep_signature: string | null;
  rep_signed_at: string | Date | null;
  void_reason: string | null;
  version: string;
};

export const ndaRef = (id: number) => `NDA-${String(id).padStart(4, "0")}`;

export const getNda = (id: number) =>
  Number.isInteger(id) && id > 0 ? queryOne<Nda>(`SELECT * FROM nda_agreements WHERE id=$1`, [id]) : Promise.resolve(null);

/** The member's current agreement (not voided), if they have one. */
export const currentNdaFor = (userId: string) =>
  queryOne<Nda>(`SELECT * FROM nda_agreements WHERE user_id=$1 AND status <> 'void' ORDER BY id DESC LIMIT 1`, [userId]);

export const ndasFor = (userId: string) => query<Nda>(`SELECT * FROM nda_agreements WHERE user_id=$1 ORDER BY id DESC`, [userId]);

export function listNdas(filter: "pending" | "countersigned" | "void" | "all") {
  return filter === "all"
    ? query<Nda>(`SELECT * FROM nda_agreements ORDER BY id DESC LIMIT 500`)
    : query<Nda>(`SELECT * FROM nda_agreements WHERE status=$1 ORDER BY id DESC LIMIT 500`, [filter]);
}

export const pendingNdaCount = () =>
  queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM nda_agreements WHERE status='pending'`)
    .then((r) => r?.n ?? 0)
    .catch(() => 0);
