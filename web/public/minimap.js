const mini = document.getElementById('mini');
const ctx = mini.getContext('2d');
const CELL = 18;

export function drawMinimap(v) {
    mini.width = v.w * CELL;
    mini.height = v.h * CELL;

    for (let y = 0; y < v.h; y++) {
        for (let x = 0; x < v.w; x++) {
            ctx.fillStyle = v.walls[y][x] ? '#8a6a45' : v.fog[y][x] ? '#2b2f36' : '#0d0f12';
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
    }

    for (const b of v.burns) {
        if (!v.fog[b.y][b.x]) continue;
        ctx.fillStyle = `rgba(0,0,0,${b.age < 1000 ? 0.9 : b.age < 5000 ? 0.6 : 0.3})`;
        ctx.beginPath();
        ctx.arc((b.x + 0.5) * CELL, (b.y + 0.5) * CELL, 0.3 * CELL, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#f2c94c';
    for (const k of v.pickups) poly(k.x, k.y, [[0, -0.3], [0.3, 0], [0, 0.3], [-0.3, 0]]);

    for (const n of v.noises) {
        ctx.strokeStyle = n.bounty ? '#ff4d4d' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc((n.x + 0.5) * CELL, (n.y + 0.5) * CELL, CELL * 0.45, 0, Math.PI * 2);
        ctx.stroke();
    }

    for (const o of v.others) {
        if (!o.alive) {
            ctx.fillStyle = '#555';
            poly(o.x, o.y, [[-0.3, -0.3], [0.3, 0.3], [0.3, 0.2], [-0.2, -0.3]]);
            poly(o.x, o.y, [[0.3, -0.3], [-0.3, 0.3], [-0.3, 0.2], [0.2, -0.3]]);
            continue;
        }
        ctx.fillStyle = o.traitor ? '#ff00ff' : o.ally ? '#4dd0e1' : '#ff5252';
        tri(o.x, o.y, o.fx, o.fy);
        if (o.aiming) aimLine(o, v);
        if (o.offering) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('T?', o.x * CELL, o.y * CELL - 2);
        }
    }

    ctx.fillStyle = '#69f0ae';
    tri(v.me.x, v.me.y, v.me.fx, v.me.fy);
    if (v.me.aiming) aimLine(v.me, v);
}

function poly(cx, cy, pts) {
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
        const X = (cx + 0.5 + px) * CELL, Y = (cy + 0.5 + py) * CELL;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    });
    ctx.closePath();
    ctx.fill();
}

function tri(x, y, fx, fy) {
    const base = [[0.4, 0], [-0.3, -0.3], [-0.3, 0.3]];
    poly(x, y, base.map(([a, b]) => [a * fx - b * fy, a * fy + b * fx]));
}

function aimLine(p, v) {
    ctx.strokeStyle = 'rgba(255,60,60,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((p.x + 0.5) * CELL, (p.y + 0.5) * CELL);
    let x = p.x, y = p.y;
    while (!v.walls[y + p.fy]?.[x + p.fx]) { x += p.fx; y += p.fy; }
    ctx.lineTo((x + 0.5) * CELL, (y + 0.5) * CELL);
    ctx.stroke();
}