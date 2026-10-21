-- Run once to make the tables (see the setup steps).
-- IF NOT EXISTS means running it twice won't break anything.

-- One row per player name: their total wins and losses
CREATE TABLE IF NOT EXISTS players (
  name   TEXT PRIMARY KEY,
  wins   INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0
);

-- One row per finished match, so we have a history
CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  winner      TEXT NOT NULL,
  loser       TEXT NOT NULL,          -- 3-4 players: losers joined like "Sam, Bo"
  floor_shots INTEGER NOT NULL,       -- floor shots that match
  played_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
