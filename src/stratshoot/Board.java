package stratshoot;

import java.util.List;

public class Board {
    final int w, h;
    final char[][] walls;

    Board(int w, int h) {
        this.w = w;
        this.h = h;
        walls = new char[h][w];
        // ill with '.', '#' on the border
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                boolean edge = x == 0 || y == 0 || x == w - 1 || y == h - 1;
                walls[y][x] = edge ? '#' : '.';
            }
        }
    }

//string builder
    String render(List<Player> players) {
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                char c = walls[y][x];
                for (Player p : players) {
                    if (p.x == x && p.y == y) {
                        if (!p.alive) c = 'x';
                        else if (System.currentTimeMillis() < p.scorchUntil) c = '*';
                        else c = p.name.charAt(0);
                    }
                }
                sb.append(c);
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    boolean isWall(int x, int y) {
        return x >= 0 && y >= 0 && x < w && y < h && walls[y][x] == '#';
    }

    void addWall(int x, int y, int bw, int bh) {
        for (int j = y; j < y + bh; j++) {
            for (int i = x; i < x + bw; i++) {
                walls[j][i] = '#';
            }
        }
    }

    //walking
    boolean canSee(int x0, int y0, int x1, int y1) {
        int dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        int sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        int err = dx + dy;
        while (x0 != x1 || y0 != y1) {
            int e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
            if ((x0 != x1 || y0 != y1) && isWall(x0, y0)) return false;
        }
        return true;
    }
}