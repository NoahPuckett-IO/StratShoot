const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'stratshoot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    name   TEXT PRIMARY KEY,
    wins   INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS matches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    winner      TEXT NOT NULL,
    loser       TEXT NOT NULL,
    floor_shots INTEGER NOT NULL,
    played_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const upsert = db.prepare(`
  INSERT INTO players (name, wins, losses) VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    wins = wins + excluded.wins,
    losses = losses + excluded.losses
`);
const addMatch = db.prepare('INSERT INTO matches (winner, loser, floor_shots) VALUES (?, ?, ?)');
const top = db.prepare('SELECT name, wins, losses FROM players ORDER BY wins DESC LIMIT 10');

function recordResult(winner, losers, floorShots) {
  upsert.run(winner, 1, 0);
  for (const name of losers) upsert.run(name, 0, 1);
  addMatch.run(winner, losers.join(', '), floorShots);
}

function leaderboard() {
  return top.all();
}

module.exports = { recordResult, leaderboard };
