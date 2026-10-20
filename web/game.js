const MAX_AMMO = 2;
const LOCKOUT_MS = 1500;
const SCORCH_MS = 800;
const MOVE_MS = 120;
const PICKUP_EVERY_MS = 5000;
const SPAWNS = [[2, 2], [17, 7]];

// Index = which neighbours are walls: up=1, right=2, down=4, left=8
const WALL = '+|-+||++-+-+++++';

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
    constructor() {
        this.board = new Board(20, 10);
        this.board.addWall(6, 3, 2, 3);
        this.board.addWall(12, 4, 3, 1);
        this.board.addWall(10, 7, 1, 1);
        this.players = [];
        this.sockets = [];
        this.burns = [];
        this.pickups = [];
        this.state = 'waiting';
        this.winner = null;
        this.startTime = 0;
        this.lastPickup = 0;
    }

    addPlayer(name) {
        const [x, y] = SPAWNS[this.players.length];
        const p = {
            name, x, y,
            ammo: MAX_AMMO, alive: true,
            lockoutUntil: 0, scorchUntil: 0, nextMove: 0,
            fx: 1, fy: 0, floorShots: 0,
        };
        this.players.push(p);
        return p;
    }

    start(now) {
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

    // Costs a bullet, kills nothing, everyone sees it.
    fireFloor(p, now) {
        if (now < p.lockoutUntil || p.ammo === 0) return;
        p.ammo--;
        p.floorShots++;
        p.lockoutUntil = now + LOCKOUT_MS;
        p.scorchUntil = now + SCORCH_MS;
        this.burns.push({ x: p.x, y: p.y, t: now });
    }

    // Hits the first opponent in sight. With no ammo nothing happens,
    // so a failed trigger pull gives nothing away.
    shoot(p, now) {
        if (now < p.lockoutUntil || p.ammo === 0) return;
        const target = this.players.find(o =>
            o !== p && o.alive && this.board.canSee(p.x, p.y, o.x, o.y));
        if (!target) return;
        p.ammo--;
        target.alive = false;
    }

    playerAt(x, y) {
        return this.players.find(o => o.alive && o.x === x && o.y === y);
    }

    tick(now) {
        if (this.state !== 'playing' || now - this.lastPickup < PICKUP_EVERY_MS) return;
        this.lastPickup = now;
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

    checkWinner() {
        const alive = this.players.filter(p => p.alive);
        if (this.players.length >= 2 && alive.length === 1) {
            this.state = 'over';
            this.winner = alive[0];
        }
    }

    // Someone disconnected. Mid-match, whoever is left wins.
    leave(p) {
        if (this.state !== 'playing') {
            this.state = 'over';
            return;
        }
        p.alive = false;
        this.checkWinner();
    }

    // You are always '@'. Others show their initial, so same names never clash.
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
        const showAll = this.state === 'over';
        if (!showAll && !b.canSee(viewer.x, viewer.y, x, y)) return '  ';

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
        if (this.state === 'waiting') return 'Waiting for an opponent...';
        if (this.state === 'over') {
            if (!this.winner) return 'Opponent left.';
            return this.winner === p ? 'You win.' : this.winner.name + ' wins.';
        }
        const secs = Math.floor((now - this.startTime) / 1000);
        const reload = now < p.lockoutUntil ? '   (reloading)' : '';
        return `Ammo: ${p.ammo}   Time: ${secs}s   Scorch marks: ${this.burns.length}${reload}`;
    }
}

function arrow(p) {
    if (p.fy < 0) return '^';
    if (p.fy > 0) return 'v';
    if (p.fx < 0) return '<';
    return '>';
}

module.exports = { Game };