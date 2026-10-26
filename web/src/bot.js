// A "bot" is just a player the server moves instead of a person and it only uses stuff a human could see too.

const LOSS = 3;        // L: how bad dying is vs how good a kill is
const THINK_MS = 300;  // bots decide ~3 times a second

export function botThink(game, bot, now) {
  if (!bot.alive || game.state !== 'playing' || now < (bot.nextThink || 0)) return null;
  bot.nextThink = now + THINK_MS;
  if (bot.drawUntil) return null; // already aiming, just wait

  // someone lined up in front? shoot
  const target = game.firstInLine(bot);
  if (target && target !== bot.ally && bot.ammo > 0 && now >= bot.lockoutUntil) return 'x';

  // low on ammo? go grab some
  if (bot.ammo < 2 && game.pickups.length) {
    const k = nearest(bot, game.pickups);
    return stepToward(game, bot, k.x, k.y);
  }

  // see an enemy? use the rush rule: rush iff q > L / (1 + L)
  const enemies = game.players.filter(o =>
    o !== bot && o.alive && o !== bot.ally && game.visible(bot, o.x, o.y));
  if (enemies.length && bot.ammo > 0) {
    const e = nearest(bot, enemies);
    if (beliefEmpty(e) > LOSS / (1 + LOSS)) return stepToward(game, bot, e.x, e.y);
    // same row/column = one turn from a shot, so line up
    if (e.x === bot.x || e.y === bot.y) return stepToward(game, bot, e.x, e.y);
  }

  // full ammo and never showed it? sometimes floor-shot to look scary
  if (bot.ammo === 2 && bot.floorShots === 0 && Math.random() < 0.05) return 'f';

  // otherwise wander and scan
  return Math.random() < 0.5 ? 'fwd' : (Math.random() < 0.5 ? 'left' : 'right');
}

// q = chance they're empty, from PUBLIC info only:
// everyone starts at 2, every shot is heard, pickups are seen
export function beliefEmpty(o) {
  const maxAmmo = Math.min(2, 2 - o.shots + (o.pickups || 0));
  if (maxAmmo <= 0) return 1;
  return maxAmmo === 1 ? 0.4 : 0.1;
}

// bots can only go forward or turn, so: face the right way, then walk
export function stepToward(game, bot, tx, ty) {
  const dirs = [];
  if (tx !== bot.x) dirs.push([Math.sign(tx - bot.x), 0]);
  if (ty !== bot.y) dirs.push([0, Math.sign(ty - bot.y)]);
  const open = dirs.find(([dx, dy]) => !game.board.isWall(bot.x + dx, bot.y + dy)) || dirs[0];
  if (!open) return null;
  const [dx, dy] = open;
  if (dx === bot.fx && dy === bot.fy) return game.board.isWall(bot.x + dx, bot.y + dy) ? 'left' : 'fwd';
  if (dx === bot.fy && dy === -bot.fx) return 'left';
  return 'right';
}

function nearest(from, list) {
  let best = null, bestD = Infinity;
  for (const o of list) {
    const d = Math.abs(o.x - from.x) + Math.abs(o.y - from.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}
