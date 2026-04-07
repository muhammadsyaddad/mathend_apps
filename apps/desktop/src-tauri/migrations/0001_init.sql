CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  category TEXT NOT NULL,
  modified_at INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  selected_note_id TEXT,
  sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
  open_tab_ids TEXT NOT NULL DEFAULT '[]'
);
