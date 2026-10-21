// The front door. Every request to the site hits this first,
// and we send it wherever it needs to go.
import { Room } from './room.js';
import { Matchmaker, randomCode } from './matchmaker.js';
import { leaderboard } from './db.js';

// Cloudflare needs these exported so it can create rooms/matchmakers
export { Room, Matchmaker };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // "Create room" button: make up a new code and hand it back.
    // The room itself gets made the moment someone connects with that code.
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return Response.json({ code: randomCode() });
    }

    // "Quick play" button: ask the one global matchmaker for a code.
    // idFromName('global') = everyone talks to the SAME matchmaker.
    if (url.pathname === '/api/quick') {
      const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global'));
      return mm.fetch(request);
    }

    // Top 10 players from the database
    if (url.pathname === '/api/leaderboard') {
      return Response.json(await leaderboard(env.DB));
    }

    // The live game connection (websocket).
    // idFromName(code) = same code always goes to the same Room.
    // That's literally how your friend ends up in your game.
    if (url.pathname === '/api/play') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase().slice(0, 6);
      if (!code) return new Response('Missing code', { status: 400 });
      const room = env.ROOM.get(env.ROOM.idFromName(code));
      return room.fetch(request);
    }

    // Anything else (like /view3d.js) is a normal file from public/
    return env.ASSETS.fetch(request);
  },
};
