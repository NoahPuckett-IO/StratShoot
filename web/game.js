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

// walls?: up=1, right=2, down=4, left=8
const WALL = '+|-+||++-+-+++++';

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

  // Walk a straight line (Bresenham). Blocked if it passes through a wall.
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
    this.sockets = [];
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
  }

  act(p, cmd, now) {
    if (this.state !== 'playing' || !p.alive) return;
    if (cmd === 'w') this.move(p, 0, -1, now);
    else if (cmd === 's') this.move(p, 0, 1, now);
    else if (cmd === 'a') this.move(p, -1, 0, now);
    else if (cmd === 'd') this.move(p, 1, 0, now);
    else if (cmd === 'f') this.fireFloor(p, now);
    else if (cmd === 'x') this.shoot(p, now);
    this.checkWinner();
  }

  move(p, dx, dy, now) {
    if (now < p.nextMove) return;
    p.nextMove = now + MOVE_MS;
    p.fx = dx;
    p.fy = dy;
    const nx = p.x + dx, ny = p.y + dy;
    if (this.board.isWall(nx, ny) || this.playerAt(nx, ny)) return;
    p.x = nx;
    p.y = ny;
    const i = this.pickups.findIndex(k => k.x === nx && k.y === ny);
    if (i >= 0 && p.ammo < MAX_AMMO) {
      p.ammo++;
      this.pickups.splice(i, 1);
    }
  }

  // Costs a bullet, kills nothing, everyone hears it.
  fireFloor(p, now) {
    if (now < p.lockoutUntil || p.ammo === 0) return;
    p.ammo--;
    p.floorShots++;
    p.lockoutUntil = now + LOCKOUT_MS;
    p.scorchUntil = now + SCORCH_MS;
    this.burns.push({ x: p.x, y: p.y, t: now });
    this.noises.push({ x: p.x, y: p.y, t: now });
  }

  // Fires straight the way you face. Misses still cost the bullet.
  // With no ammo nothing happens, so an empty trigger pull is silent.
  shoot(p, now) {
    if (now < p.lockoutUntil || p.ammo === 0) return;
    p.ammo--;
    p.lockoutUntil = now + LOCKOUT_MS;
    this.noises.push({ x: p.x, y: p.y, t: now });
    let x = p.x + p.fx, y = p.y + p.fy;
    while (!this.board.isWall(x, y)) {
      const hit = this.playerAt(x, y);
      if (hit) {
        hit.alive = false;
        return;
      }
      x += p.fx;
      y += p.fy;
    }
  }

  playerAt(x, y) {
    return this.players.find(o => o.alive && o.x === x && o.y === y);
  }

  tick(now) {
    if (this.state !== 'playing') return;
    if (now - this.lastPickup >= PICKUP_EVERY_MS) {
      this.lastPickup = now;
      this.spawnPickup();
    }
    const ring = Math.floor((now - this.startTime - ZONE_START_MS) / ZONE_EVERY_MS) + 1;
    if (ring > this.zone && this.zone < MAX_RING) {
      this.zone++;
      this.closeRing(this.zone);
    }
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

  // Ring k (0 = outer border) turns to wall. Anyone standing on it dies.
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
      if (this.host === p) this.host = this.players[0] || null;
      if (this.players.length === 0) this.state = 'over';
      return;
    }
    p.alive = false;
    this.checkWinner();
  }

  // You are always '@'. Making sure yk where u r
  render(viewer, now) {
    let out = '';
    for (let y = 0; y < this.board.h; y++) {
      for (let x = 0; x < this.board.w; x++) {
        out += this.tile(viewer, x, y, now);
      }
      out += '\n';
    }
    return out;
  }

  tile(viewer, x, y, now) {
    const b = this.board;
    if (b.isWall(x, y)) {
      const mask = (b.isWall(x, y - 1) ? 1 : 0) | (b.isWall(x + 1, y) ? 2 : 0)
                 | (b.isWall(x, y + 1) ? 4 : 0) | (b.isWall(x - 1, y) ? 8 : 0);
      return WALL[mask] + (mask & 2 ? '-' : ' ');
    }

    // Dead players and finished games see everything.
    const showAll = this.state === 'over' || !viewer.alive;
    if (!showAll && !b.canSee(viewer.x, viewer.y, x, y)) {
      const heard = this.noises.some(n => n.x === x && n.y === y && now - n.t < NOISE_MS);
      return heard ? '! ' : '  ';
    }

    const p = this.playerAt(x, y) || this.players.find(o => o.x === x && o.y === y);
    if (p) {
      const face = p === viewer ? '@' : p.name[0].toUpperCase();
      if (!p.alive) return 'X ';
      if (now < p.scorchUntil) return '*' + face;
      return face + arrow(p);
    }
    if (this.pickups.some(k => k.x === x && k.y === y)) return 'o ';

    // The floor remembers floor shots: % fresh, * recent, , old.
    let mark = '. ';
    for (const s of this.burns) {
      if (s.x !== x || s.y !== y) continue;
      const age = now - s.t;
      mark = age < 1000 ? '% ' : age < 5000 ? '* ' : ', ';
    }
    return mark;
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
    const reload = now < p.lockoutUntil ? '   (reloading)' : '';
    return `Ammo: ${p.ammo}   Alive: ${alive}   Time: ${secs}s   ${zone}   Scorch marks: ${this.burns.length}${reload}`;
  }
}

function arrow(p) {
  if (p.fy < 0) return '^';
  if (p.fy > 0) return 'v';
  if (p.fx < 0) return '<';
  return '>';
}

module.exports = { Game };
