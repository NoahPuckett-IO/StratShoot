// One Room = one room code = one little server running one game.
// Everyone who connects with the same code ends up in here together.
import { Game } from './game.js';
import { recordResult } from './db.js';

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;         // has env.DB (the database)
    this.game = null;       // the current match (game.js)
    this.conns = new Set(); // everyone connected: { ws, player }
    this.timer = null;      // the 10x a second update loop
  }

  // Runs when a player connects from the page
  async fetch(request) {
    // Only websockets allowed in here
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    // Read what the page put in the URL (?code=...&quick=...&name=...)
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').toUpperCase();
    const quick = url.searchParams.get('quick') === '1';
    const name = (url.searchParams.get('name') || '').trim().slice(0, 16) || 'anon';

    // A websocket is a pair: one end goes back to the browser (client),
    // we keep the other end (server) to talk through
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    // New room, or last match ended? Fresh game (that's how rematch works).
    // Quick play = 2 players, auto start. Normal room = up to 4, host presses Start.
    if (!this.game || this.game.state === 'over') {
      this.game = quick ? new Game(null, 2) : new Game(code, 4);
    }
    const g = this.game;

    // Try to sit them down. null = room full or already playing.
    const player = g.addPlayer(name);
    if (!player) {
      send(server, { text: '', status: `Room ${code} is full or already playing.`, over: true });
      server.close(1000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const conn = { ws: server, player };
    this.conns.add(conn);

    // Quick play starts by itself once 2 people are in
    if (quick && g.players.length === 2) g.start(Date.now());

    // Messages from this player's browser
    server.addEventListener('message', e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; } // ignore garbage
      const now = Date.now();
      if (msg.type === 'start') {
        // Only the host can start, and only with 2+ people
        if (g.state === 'waiting' && g.host === player && g.players.length >= 2) g.start(now);
      } else if (msg.type === 'act') {
        g.act(player, msg.cmd, now); // moves, turns, shots
      }
    });

    // They closed the tab or lost wifi
    server.addEventListener('close', () => {
      this.conns.delete(conn);
      g.leave(player);
    });

    // Start the update loop if it isn't running yet
    if (!this.timer) this.timer = setInterval(() => this.tick(), 100);

    // 101 = "ok, switching to websocket"
    return new Response(null, { status: 101, webSocket: client });
  }

  // 10 times a second: update the game, then send everyone their own view.
  // Everyone gets a different view because of fog (that's the anti-cheat).
  tick() {
    const g = this.game;
    const now = Date.now();
    g.tick(now);
    for (const c of this.conns) {
      send(c.ws, {
        view: g.view(c.player, now),
        status: g.status(c.player, now),
        host: g.state === 'waiting' && g.host === c.player && g.code !== null,
        over: g.state === 'over',
        playing: g.state === 'playing',
      });
    }
    if (g.state === 'over') this.finish(g);
  }

  // When match over: we stop the loop, kick everyone back to the menu, and save the result to the leaderboard
  async finish(g) {
    clearInterval(this.timer);
    this.timer = null;
    const conns = [...this.conns];
    this.conns.clear();
    for (const c of conns) c.ws.close(1000, 'match over');
    if (g.winner) {
      const losers = g.players.filter(p => p !== g.winner).map(p => p.name);
      await recordResult(this.env.DB, g.winner.name, losers, g.burns.length);
    }
  }
}

// Send without crashing if their connection already died
function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch {}

  //
}
