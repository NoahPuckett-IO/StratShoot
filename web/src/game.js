//boring constants
const MAX_AMMO = 2;
const LOCKOUT_MS = 1500;
const SCORCH_MS = 800;
const MOVE_MS = 120;
const PICKUP_EVERY_MS = 5000;
const NOISE_MS = 1000;
const ZONE_START_MS = 60000;
const ZONE_EVERY_MS = 15000;
const MAX_RING = 3;
const SPAWNS = [[2, 2], [17, 7], [17, 2], [2, 7]];
const DRAW_MS = 400;
const OFFER_MS = 5000;
const TRAITOR_MS = 15000;
const BOUNTY_EVERY_MS = 10000;
const FEED_MAX = 5;

function hitChance(dist) {
  return Math.max(0.35, 1 - 0.08 * (dist - 1));
}

//getting board for minimap
class Board {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.walls = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1);
      }
      this.walls.push(row);
    }
  }

//whats a wall?
  isWall(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.walls[y][x];
  }

  addWall(x, y, bw, bh) {
    for (let j = y; j < y + bh; j++) {
      for (let i = x; i < x + bw; i++) {
        this.walls[j][i] = true;
      }
    }
  }

  // walls
  canSee(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (x0 !== x1 || y0 !== y1) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      if ((x0 !== x1 || y0 !== y1) && this.isWall(x0, y0)) return false;
    }
    return true;
  }
}

class Game {
  // code = room code, or null for the random queue
  constructor(code, maxPlayers) {
    this.code = code;
    this.maxPlayers = maxPlayers;
    this.board = new Board(20, 10);
    this.board.addWall(6, 3, 2, 3);
    this.board.addWall(12, 4, 3, 1);
    this.board.addWall(10, 7, 1, 1);
    this.players = [];
    this.feed = [];
    this.lastBounty = 0;
    this.burns = [];
    this.noises = [];
    this.pickups = [];
    this.state = 'waiting';
    this.host = null;
    this.winner = null;
    this.startTime = 0;
    this.lastPickup = 0;
    this.zone = 0;
  }

  addPlayer(name) {
    if (this.state !== 'waiting' || this.players.length >= this.maxPlayers) return null;
    const [x, y] = SPAWNS[this.players.length];
    const p = {
      drawUntil: 0, shots: 0, kills: 0, pickups: 0, bot: false,
      offerTo: null, offerUntil: 0,
      ally: null, traitorUntil: 0,
      name, x, y,
      ammo: MAX_AMMO, alive: true,
      lockoutUntil: 0, scorchUntil: 0, nextMove: 0,
      fx: 1, fy: 0, floorShots: 0,
    };
    this.players.push(p);
    if (!this.host) this.host = p;
    return p;
  }

  start(now) {
    this.players.forEach((p, i) => {
      [p.x, p.y] = SPAWNS[i];
    });
    this.state = 'playing';
    this.startTime = now;
    this.lastPickup = now;
    this.lastBounty = now;
  }

  act(p, cmd, now) {
    if (this.state !== 'playing' || !p.alive) return;
    // W/S step forward/back along where you face, A/D spin left/right
    if (cmd === 'fwd') this.move(p, p.fx, p.fy, now, true);
    else if (cmd === 'back') this.move(p, -p.fx, -p.fy, now, false);
    else if (cmd === 'left') this.turn(p, p.fy, -p.fx, now);
    else if (cmd === 'right') this.turn(p, -p.fy, p.fx, now);
    else if (cmd === 'f') this.fireFloor(p, now);
    else if (cmd === 'x') this.draw(p, now);
    else if (cmd === 't') this.offerTruce(p, now);
    else if (cmd === 'g') this.claim(p, now);
    this.checkWinner();
  }

  // face = true means "turn to face where you step" (forward). Back-stepping keeps your facing.
  move(p, dx, dy, now, face) {
    if (now < p.nextMove || p.drawUntil) return;
    p.nextMove = now + MOVE_MS;
    if (face) {
      p.fx = dx;
      p.fy = dy;
    }
    const nx = p.x + dx, ny = p.y + dy;
    if (this.board.isWall(nx, ny) || this.playerAt(nx, ny)) return;
    p.x = nx;
    p.y = ny;
    const i = this.pickups.findIndex(k => k.x === nx && k.y === ny);
    if (i >= 0 && p.ammo < MAX_AMMO) {
      p.ammo++;
      p.pickups++; // public: others can count this
      this.pickups.splice(i, 1);
      this.noises.push({ x: nx, y: ny, t: now });
    }
  }

  // Spin 90 degrees without stepping. Same speed limit as walking.
  turn(p, fx, fy, now) {
    if (now < p.nextMove || p.drawUntil) return;
    p.nextMove = now + MOVE_MS;
    p.fx = fx;
    p.fy = fy;
  }

  // floor firing what it does
  fireFloor(p, now) {
    if (now < p.lockoutUntil || p.ammo === 0 || p.drawUntil) return;
    p.ammo--;
    p.shots++;
    p.floorShots++;
    p.lockoutUntil = now + LOCKOUT_MS;
    p.scorchUntil = now + SCORCH_MS;
    this.burns.push({ x: p.x, y: p.y, t: now });
    this.noises.push({ x: p.x, y: p.y, t: now });
    this.log(now, `${p.name} fired at the floor`);
  }

  // shooting junk logic
  log(now, text) {
    this.feed.push({ t: now, text });
    if (this.feed.length > FEED_MAX) this.feed.shift();
  }

  claim(p, now) {
    if (now < p.nextMove) return;
    p.nextMove = now + 1000;
    this.log(now, `${p.name}: "I'm loaded."`);
  }

  draw(p, now) {
    if (now < p.lockoutUntil || p.ammo === 0 || p.drawUntil) return;
    p.drawUntil = now + DRAW_MS;
  }

  shoot(p, now) {
    p.drawUntil = 0;
    if (!p.alive || p.ammo === 0) return;
    p.ammo--;
    p.shots++;
    p.lockoutUntil = now + LOCKOUT_MS;
    this.noises.push({ x: p.x, y: p.y, t: now });
    let x = p.x + p.fx, y = p.y + p.fy, dist = 1;
    while (!this.board.isWall(x, y)) {
      const hit = this.playerAt(x, y);
      if (hit) {
        if (hit === p.ally) this.betray(p, now);
        if (Math.random() < hitChance(dist)) {
          hit.alive = false;
          p.kills++;
          this.log(now, `${p.name} killed ${hit.name}`);
        } else {
          this.log(now, `${p.name} missed ${hit.name}`);
        }
        return;
      }
      x += p.fx; y += p.fy; dist++;
    }
  }

  offerTruce(p, now) {
    if (p.ally || this.alive().length <= 2) return;
    const target = this.firstInLine(p);
    if (!target || target.ally) return;
    if (target.offerTo === p && now < target.offerUntil) {
      p.ally = target;
      target.ally = p;
      p.offerTo = target.offerTo = null;
      this.log(now, `${p.name} and ${target.name} made a truce`);
    } else {
      p.offerTo = target;
      p.offerUntil = now + OFFER_MS;
    }
  }

  betray(p, now) {
    const a = p.ally;
    p.ally = null;
    if (a) a.ally = null;
    p.traitorUntil = now + TRAITOR_MS;
    this.log(now, `${p.name} BETRAYED ${a.name}`);
  }

  dissolvePacts(now) {
    let broke = false;
    for (const p of this.players) if (p.ally) { p.ally = null; broke = true; }
    if (broke) this.log(now, 'Two left. All truces are over.');
  }

  firstInLine(p) {
    let x = p.x + p.fx, y = p.y + p.fy;
    while (!this.board.isWall(x, y)) {
      const o = this.playerAt(x, y);
      if (o) return o;
      x += p.fx; y += p.fy;
    }
    return null;
  }

  alive() {
    return this.players.filter(p => p.alive);
  }

  sees(p, x, y) {
    const dx = x - p.x, dy = y - p.y;
    const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
    if (!near && dx * p.fx + dy * p.fy < 0) return false;
    return this.board.canSee(p.x, p.y, x, y);
  }

  visible(viewer, x, y) {
    if (this.state === 'over' || !viewer.alive) return true;
    if (this.sees(viewer, x, y)) return true;
    return !!(viewer.ally && viewer.ally.alive && this.sees(viewer.ally, x, y));
  }

  playerAt(x, y) {
    return this.players.find(o => o.alive && o.x === x && o.y === y);
  }

  tick(now) {
    if (this.state !== 'playing') return;
    if (now - this.lastPickup >= PICKUP_EVERY_MS) {
      this.lastPickup = now;
      this.spawnPickup();
      if (now - this.lastBounty >= BOUNTY_EVERY_MS) {
        this.lastBounty = now;
        const top = this.alive().sort((a, b) => b.kills - a.kills);
        if (top[0] && top[0].kills > 0 && (!top[1] || top[0].kills > top[1].kills)) {
          this.noises.push({ x: top[0].x, y: top[0].y, t: now, bounty: true });
          this.log(now, `Bounty: ${top[0].name} pinged`);
        }
      }
      if (this.alive().length === 2) this.dissolvePacts(now);
    }
    const ring = Math.floor((now - this.startTime - ZONE_START_MS) / ZONE_EVERY_MS) + 1;
    if (ring > this.zone && this.zone < MAX_RING) {
      this.zone++;
      this.closeRing(this.zone);
    }
    // aim time's up -> the shot actually fires
    for (const p of this.alive()) {
      if (p.drawUntil && now >= p.drawUntil) this.shoot(p, now);
    }
    this.noises = this.noises.filter(n => now - n.t < NOISE_MS);
    this.checkWinner();
  }

  spawnPickup() {
    for (let tries = 0; tries < 100; tries++) {
      const x = Math.floor(Math.random() * this.board.w);
      const y = Math.floor(Math.random() * this.board.h);
      const taken = this.pickups.some(k => k.x === x && k.y === y);
      if (!this.board.isWall(x, y) && !this.playerAt(x, y) && !taken) {
        this.pickups.push({ x, y });
        return;
      }
    }
  }

  // making place smaller
  closeRing(k) {
    const b = this.board;
    for (let y = k; y < b.h - k; y++) {
      for (let x = k; x < b.w - k; x++) {
        if (x !== k && y !== k && x !== b.w - 1 - k && y !== b.h - 1 - k) continue;
        b.walls[y][x] = true;
        const p = this.playerAt(x, y);
        if (p) p.alive = false;
      }
    }
    this.pickups = this.pickups.filter(o => !b.isWall(o.x, o.y));
    this.checkWinner();
  }

  checkWinner() {
    if (this.state !== 'playing') return;
    const alive = this.players.filter(p => p.alive);
    if (alive.length <= 1) {
      this.state = 'over';
      this.winner = alive[0] || null;
    }
  }

  leave(p) {
    if (this.state === 'waiting') {
      this.players = this.players.filter(o => o !== p);
      // host goes to the next human. only bots left = room's dead
      if (this.host === p) this.host = this.players.find(o => !o.bot) || null;
      if (!this.host) this.state = 'over';
      return;
    }
    p.alive = false;
    if (p.ally) p.ally.ally  = null;
    p.ally = null;
    this.checkWinner();
  }

  //three.js genuinely works because of ts:
  view(viewer, now) {
    const b = this.board;
    const fog = [];
    for (let y = 0; y < b.h; y++) {
      const row = [];
      for (let x = 0; x < b.w; x++) row.push(this.visible(viewer, x, y) ? 1 : 0);
      fog.push(row);
    }
    const others = this.players
        .filter(p => p !== viewer)
        .filter(p => fog[p.y][p.x] || p === viewer.ally || now < p.traitorUntil)
        .map(p => ({
          name: p.name, x: p.x, y: p.y, fx: p.fx, fy: p.fy, alive: p.alive,
          aiming: !!p.drawUntil,
          ally: p === viewer.ally,
          traitor: now < p.traitorUntil,
          offering: p.offerTo === viewer && now < p.offerUntil,
        }));
    return {
      w: b.w, h: b.h, walls: b.walls, fog,
      me: { x: viewer.x, y: viewer.y, fx: viewer.fx, fy: viewer.fy, aiming: !!viewer.drawUntil },
      others,
      pickups: this.pickups.filter(k => fog[k.y][k.x]),
      noises: this.noises.map(n => ({ x: n.x, y: n.y, bounty: !!n.bounty })),
      burns: this.burns.map(s => ({ x: s.x, y: s.y, age: now - s.t })),
      ledger: this.players.map(p => ({ name: p.name, shots: p.shots, kills: p.kills, alive: p.alive })),
      feed: this.feed.filter(f => now - f.t < 8000).map(f => f.text),
      odds: this.oddsFor(viewer),
    };
  }

  oddsFor(p) {
    let x = p.x + p.fx, y = p.y + p.fy, dist = 1;
    while (!this.board.isWall(x, y)) {
      const o = this.playerAt(x, y);
      if (o && this.visible(p, x, y)) return { name: o.name, chance: Math.round(hitChance(dist) * 100) };
      if (o) return null;
      x += p.fx; y += p.fy; dist++;
    }
    return null;
  }


  status(p, now) {
    if (this.state === 'waiting') {
      if (!this.code) return 'Waiting for an opponent...';
      const who = this.host === p ? 'Press Start when ready.' : 'Waiting for the host to start.';
      return `Room ${this.code}: ${this.players.length}/${this.maxPlayers} players. ${who}`;
    }
    if (this.state === 'over') {
      if (!this.winner) return 'Nobody wins.';
      return this.winner === p ? 'You win :)' : this.winner.name + ' wins.';
    }
    if (!p.alive) return 'You died :(';

    const secs = Math.floor((now - this.startTime) / 1000);
    const alive = this.players.filter(o => o.alive).length;
    let zone = 'Walls fully closed';
    if (this.zone < MAX_RING) {
      const next = this.startTime + ZONE_START_MS + this.zone * ZONE_EVERY_MS;
      zone = `Walls close in ${Math.ceil((next - now) / 1000)}s`;
    }
    let tag = '';
    if (p.drawUntil) tag = '   AIMING';
    else if (now < p.lockoutUntil) tag = '   (reloading)';
    const ally = p.ally ? `   Ally: ${p.ally.name}` : '';
    return `Ammo: ${p.ammo}   Alive: ${this.alive().length}   Time: ${secs}s   ${zone}${ally}${tag}`;
  }
}

export { Game };
