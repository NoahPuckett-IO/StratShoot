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
  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ server });
const games = new Set();
let waiting = null;

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'join' && !ws.game) {
      join(ws, String(msg.name || '').trim().slice(0, 16) || 'anon');
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

function join(ws, name) {
  if (!waiting) {
    waiting = new Game();
    games.add(waiting);
  }
  const g = waiting;
  ws.game = g;
  ws.player = g.addPlayer(name);
  g.sockets.push(ws);
  if (g.players.length === 2) {
    g.start(Date.now());
    waiting = null;
  }
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
        over: g.state === 'over',
      });
    }
    if (g.state === 'over') finish(g);
  }
}, 100);

function finish(g) {
  games.delete(g);
  if (waiting === g) waiting = null;
  if (g.winner) {
    const loser = g.players.find(p => p !== g.winner);
    db.recordResult(g.winner.name, loser.name, g.burns.length);
  }
  for (const ws of g.sockets) ws.game = null;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

server.listen(PORT, () => console.log(`StratShoot on http://localhost:${PORT}`));
