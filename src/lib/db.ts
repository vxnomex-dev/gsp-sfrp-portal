import "server-only";
import { SCHEMA_SQL, seedDefaults } from "./schema";

/**
 * Tiny database layer.
 *  - If DATABASE_URL is set  -> real PostgreSQL (Neon, Supabase, Railway, etc.)
 *  - If it is not set         -> PGlite, an embedded Postgres stored in ./.data (great for local testing)
 * Tables are created automatically on first use — no migration step needed.
 */

type Row = Record<string, unknown>;
type Client = { query: (text: string, params?: unknown[]) => Promise<Row[]> };

const g = globalThis as unknown as { __gspDb?: Promise<Client> };

async function createClient(): Promise<Client> {
  const url = process.env.DATABASE_URL;
  let client: Client;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    client = {
      query: async (text, params = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as Row[],
    };
  } else {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL is not set. Add a Postgres connection string in Vercel → Settings → Environment Variables.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    const dir = process.env.PGLITE_DIR || "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    await pg.waitReady;
    client = {
      query: async (text, params = []) => (await pg.query<Row>(text, params)).rows,
    };
  }
  for (const stmt of SCHEMA_SQL) await client.query(stmt);
  await seedDefaults(client);
  return client;
}

function getClient() {
  if (!g.__gspDb) {
    g.__gspDb = createClient().catch((err) => {
      g.__gspDb = undefined;
      throw err;
    });
  }
  return g.__gspDb;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = await getClient();
  return (await c.query(text, params)) as T[];
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
