// =============================================================
// Postgres database client (Vercel Postgres / Neon)
// Auto-creates tables on first run via initDb().
// =============================================================

import { sql } from "@vercel/postgres";

let initPromise: Promise<void> | null = null;

/**
 * Idempotently create the tables we need. Called automatically
 * before any DB-using API route runs (cached after first success).
 */
export function initDb(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Events: one row per scheduled event
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        calendar TEXT NOT NULL CHECK (calendar IN ('elites', 'plats')),
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        location TEXT DEFAULT '',
        url TEXT DEFAULT '',
        organizer TEXT DEFAULT '',
        organizer_email TEXT DEFAULT '',
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        all_day BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS events_calendar_starts_idx
        ON events (calendar, starts_at);
    `;

    // Admins: in-app admin overrides (in addition to BOOTSTRAP_ADMINS env)
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        email TEXT PRIMARY KEY,
        name TEXT DEFAULT '',
        added_by TEXT,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // Legends: color labels per calendar (admin-managed)
    await sql`
      CREATE TABLE IF NOT EXISTS legends (
        id TEXT PRIMARY KEY,
        calendar TEXT NOT NULL CHECK (calendar IN ('elites', 'plats')),
        label TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6b7280',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS legends_calendar_idx
        ON legends (calendar, sort_order);
    `;

    // Add legend_id to events if not already there
    await sql`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS legend_id TEXT REFERENCES legends(id) ON DELETE SET NULL;
    `;
  })().catch((err) => {
    initPromise = null; // allow retry
    throw err;
  });
  return initPromise;
}

export { sql };
