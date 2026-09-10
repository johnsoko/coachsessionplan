-- Run once against the D1 database:
--   npx wrangler d1 execute coachsessionplan-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS drills (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Play',
  data TEXT NOT NULL,          -- JSON blob: phases, description, output settings, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drills_updated_at ON drills(updated_at);
