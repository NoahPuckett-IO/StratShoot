const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');
const db = require('./db');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/leaderboard') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(db.leaderboard()));
    return;
  }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
    return;
  }
  if (reg.url === '/view3d.js') {
    res.setHeader('Content-Type', 'text/javascript');
    fs.createReadStream(path(join(__dirname, 'public', 'view3d.js')).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ server });
const games = new Set();
const rooms = new Map();
let queue = null;

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join' && !ws.game) {
      const name = String(msg.name || '').trim().slice(0, 16) || 'anon';
      const code = String(msg.room || '').trim().toUpperCase().slice(0, 6);
      if (code) joinRoom(ws, name, code);
      else joinQueue(ws, name);
    } else if (msg.type === 'start' && ws.game) {
      const g = ws.game;
      if (g.state === 'waiting' && g.host === ws.player && g.players.length >= 2) {
        g.start(Date.now());
      }
    } else if (msg.type === 'act' && ws.game) {
      ws.game.act(ws.player, msg.cmd, Date.now());
    }
  });

  ws.on('close', () => {
    if (!ws.game) return;
    ws.game.sockets = ws.game.sockets.filter(s => s !== ws);
    ws.game.leave(ws.player);
  });
});

// Random 1v1: starts as soon as two people are waiting.
function joinQueue(ws, name) {
  if (!queue) {
    queue = new Game(null, 2);
    games.add(queue);
  }
  const g = queue;
  seat(ws, g, name);
  if (g.players.length === 2) {
    g.start(Date.now());
    queue = null;
  }
}

// Private room: up to 4, the first player in is host and presses Start.
function joinRoom(ws, name, code) {
  let g = rooms.get(code);
  if (!g) {
    g = new Game(code, 4);
    rooms.set(code, g);
    games.add(g);
  }
  if (!seat(ws, g, name)) {
    send(ws, { text: '', status: `Room ${code} is full or already playing.`, over: true });
  }
}

function seat(ws, g, name) {
  const p = g.addPlayer(name);
  if (!p) return false;
  ws.game = g;
  ws.player = p;
  g.sockets.push(ws);
  return true;
}

// 10 times a second: update every match and send each player their own view.
setInterval(() => {
  const now = Date.now();
  for (const g of games) {
    g.tick(now);
    for (const ws of g.sockets) {
      send(ws, {
        text: g.render(ws.player, now),
        status: g.status(ws.player, now),
        host: g.state === 'waiting' && g.host === ws.player && g.code !== null,
        over: g.state === 'over',
      });
    }
    if (g.state === 'over') finish(g);
  }
}, 100);

function finish(g) {
  games.delete(g);
  if (queue === g) queue = null;
  if (g.code && rooms.get(g.code) === g) rooms.delete(g.code);
  if (g.winner) {
    const losers = g.players.filter(p => p !== g.winner).map(p => p.name);
    db.recordResult(g.winner.name, losers, g.burns.length);
  }
  for (const ws of g.sockets) ws.game = null;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

server.listen(PORT, () => console.log(`StratShoot on http://localhost:${PORT}`));
