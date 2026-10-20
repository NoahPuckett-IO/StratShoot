package stratshoot;

public class Renderer {
    static final String RESET = "\u001B[0m";
    static final String DIM = "\u001B[90m";
    static final String RED = "\u001B[31m";
    static final String YELLOW = "\u001B[33m";
    static final String[] COLORS = {"\u001B[36m", "\u001B[35m", "\u001B[32m", "\u001B[34m"};

    // Index = which neighbours are walls: up=1, right=2, down=4, left=8
    static final char[] WALL = {
            '+', '|', '-', '+', '|', '|', '+', '+',
            '-', '+', '-', '+', '+', '+', '+', '+'
    };

    // viewer = whose eyes we draw through. null = show everything.
    static String render(Game game, Board b, Player viewer) {
        long now = System.currentTimeMillis();
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < b.h; y++) {
            for (int x = 0; x < b.w; x++) {
                sb.append(tile(game, b, viewer, x, y, now));
            }
            sb.append('\n');
        }
        sb.append(hud(game, now));
        return sb.toString();
    }

    static String tile(Game game, Board b, Player viewer, int x, int y, long now) {
        if (b.isWall(x, y)) return wall(b, x, y);
        boolean seen = viewer == null || b.canSee(viewer.x, viewer.y, x, y);
        if (!seen) return "  ";
        for (int i = 0; i < game.players.size(); i++) {
            Player p = game.players.get(i);
            if (p.x == x && p.y == y) return sprite(p, i, now);
        }
        if (game.pickupAt(x, y) != null) return YELLOW + "o " + RESET;
        return floor(game, x, y, now);
    }

    static String wall(Board b, int x, int y) {
        int mask = 0;
        if (b.isWall(x, y - 1)) mask |= 1;
        if (b.isWall(x + 1, y)) mask |= 2;
        if (b.isWall(x, y + 1)) mask |= 4;
        if (b.isWall(x - 1, y)) mask |= 8;
        char fill = (mask & 2) != 0 ? '-' : ' ';
        return "" + WALL[mask] + fill;
    }

    static String sprite(Player p, int i, long now) {
        if (!p.alive) return RED + "X " + RESET;
        if (now < p.scorchUntil) return YELLOW + "*" + p.name.charAt(0) + RESET;
        return COLORS[i % COLORS.length] + p.name.charAt(0) + arrow(p) + RESET;
    }

    static char arrow(Player p) {
        if (p.fy < 0) return '^';
        if (p.fy > 0) return 'v';
        if (p.fx < 0) return '<';
        return '>';
    }

    // Floor remembers every floor shot: @ fresh, * recent, , old.
    static String floor(Game game, int x, int y, long now) {
        String mark = DIM + ". " + RESET;
        for (long[] burn : game.burns) {
            if (burn[0] != x || burn[1] != y) continue;
            long age = now - burn[2];
            if (age < 1000) mark = YELLOW + "@ " + RESET;
            else if (age < 5000) mark = RED + "* " + RESET;
            else mark = RED + ", " + RESET;
        }
        return mark;
    }

    static String hud(Game game, long now) {
        int alive = 0;
        for (Player p : game.players) {
            if (p.alive) alive++;
        }
        long secs = (now - game.startTime) / 1000;
        return String.format("Turn: %d   Alive: %d   Time: %d:%02d   Scorch marks: %d%n",
                game.turn, alive, secs / 60, secs % 60, game.burns.size());
    }
}