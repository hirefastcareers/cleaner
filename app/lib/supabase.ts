import { createClient, SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

let supabase: SupabaseClient | null = null;
let tableReady: Promise<void> | null = null;

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

export function getSupabaseAdmin() {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!supabase) {
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/** Ensure the key/value table exists (idempotent). */
export function ensureAppStateTable() {
  if (!tableReady) {
    tableReady = (async () => {
      const connectionString =
        process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
      if (!connectionString) {
        throw new Error("Missing POSTGRES_URL");
      }
      const sql = postgres(connectionString, {
        ssl: "require",
        max: 1,
        idle_timeout: 5,
        connect_timeout: 10,
      });
      try {
        await sql`
          create table if not exists app_state (
            key text primary key,
            value jsonb not null default 'null'::jsonb,
            updated_at timestamptz not null default now()
          )
        `;
        await sql`alter table app_state enable row level security`;
        // PostgREST caches the schema; refresh so .from('app_state') works immediately.
        await sql`notify pgrst, 'reload schema'`;
      } finally {
        await sql.end({ timeout: 5 });
      }
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export function stateKey(key: string) {
  return `home-rota:${key}`;
}
