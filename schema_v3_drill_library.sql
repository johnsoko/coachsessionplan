-- Adds the drill_library table: individual drills a coach has explicitly
-- chosen to save for reuse, separate from full practice plans. Never
-- auto-populated — only created when a user checks a drill and saves.
CREATE TABLE drill_library (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  data TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX idx_drill_library_user_id ON drill_library(user_id);
