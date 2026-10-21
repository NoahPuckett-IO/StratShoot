// All the SQL stuff lives here. `db` is the D1 database Cloudflare gives us.

// Add to a player's wins/losses. If they don't exist yet, make their row.
// The ?s get filled in by .bind() later (safer than gluing strings together).
const UPSERT = `
  INSERT INTO players (name, wins, losses) VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    wins = wins + excluded.wins,
    losses = losses + excluded.losses`;

// Called when a match ends. batch() runs everything together in one go.
export async function recordResult(db, winner, losers, floorShots) {
  await db.batch([
    db.prepare(UPSERT).bind(winner, 1, 0),                      // winner +1 win
    ...losers.map(name => db.prepare(UPSERT).bind(name, 0, 1)), // each loser +1 loss
    db.prepare('INSERT INTO matches (winner, loser, floor_shots) VALUES (?, ?, ?)')
      .bind(winner, losers.join(', '), floorShots),             // save the match
  ]);
}

// Top 10 by wins, for the leaderboard on the page
export async function leaderboard(db) {
  const { results } = await db
    .prepare('SELECT name, wins, losses FROM players ORDER BY wins DESC LIMIT 10')
    .all();
  return results;
}
