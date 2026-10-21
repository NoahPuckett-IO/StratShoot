// No I, O, 0 or 1 so nobody mixes them up reading a code to a friend
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// Makes a 5 letter code like KTRPW
export function randomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return code;
}

// Quick play pairing. Hands the same code to every 2 people,
// then makes a fresh code for the next 2.
// Quick codes start with Q so they never clash with normal rooms.
export class Matchmaker {
  constructor(ctx) {
    this.ctx = ctx;
    this.code = null; // the code people are currently being sent to
    this.count = 0;   // how many people got this code so far
  }

  async fetch() {
    if (!this.code || this.count >= 2) {
      this.code = 'Q' + randomCode();
      this.count = 0;
    }
    this.count++;
    return Response.json({ code: this.code });
  }
}
