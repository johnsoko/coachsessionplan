-- Run once against the D1 database (the base table already exists):
--   npx wrangler d1 execute coachsessionplan-db --remote --file=schema_v2_auth.sql

ALTER TABLE drills ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_drills_user_id ON drills(user_id);
