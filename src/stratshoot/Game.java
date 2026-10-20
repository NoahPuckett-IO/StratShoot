package stratshoot;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class Game {

    static final long LOCKOUT_MS = 1500;
    static final int PICKUP_EVERY = 6;

    final List<Player> players = new ArrayList<>();
    final List<long[]> burns = new ArrayList<>();
    final List<int[]> pickups = new ArrayList<>();
    final Random rng = new Random();
    long startTime = System.currentTimeMillis();
    int turn = 0;

    boolean fireFloor(Player p, long now) {
        if (!p.canAct(now) || p.ammo == 0) return false;
        p.ammo--;
        p.floorShots++;
        p.lockoutUntil = now + LOCKOUT_MS;
        p.scorchUntil = now + 800;
        burns.add(new long[]{p.x, p.y, now});
        return true;
    }

    boolean fireAt(Player shooter, Player target, long now) {
        if (!shooter.canAct(now) || shooter.ammo == 0 || !target.alive) return false;
        shooter.ammo--;
        target.alive = false;
        return true;
    }

    boolean move(Player p, Board b, int dx, int dy) {
        if (!p.alive) return false;
        p.fx = dx;
        p.fy = dy;
        int nx = p.x + dx, ny = p.y + dy;
        if (b.isWall(nx, ny)) return false;
        if (playerAt(nx, ny) != null) return false;
        p.x = nx;
        p.y = ny;
        collect(p);
        return true;
    }

    Player playerAt(int x, int y) {
        for (Player o : players) {
            if (o.alive && o.x == x && o.y == y) return o;
        }
        return null;
    }

    int[] pickupAt(int x, int y) {
        for (int[] k : pickups) {
            if (k[0] == x && k[1] == y) return k;
        }
        return null;
    }

    // Walking onto a pickup gives 1 bullet, but never above the cap.
    void collect(Player p) {
        int[] k = pickupAt(p.x, p.y);
        if (k == null || p.ammo >= Player.MAX_AMMO) return;
        p.ammo++;
        p.pickups++;
        pickups.remove(k);
    }

    void endTurn(Board b) {
        turn++;
        if (turn % PICKUP_EVERY == 0) spawnPickup(b);
    }

    void spawnPickup(Board b) {
        for (int tries = 0; tries < 100; tries++) {
            int x = rng.nextInt(b.w), y = rng.nextInt(b.h);
            if (!b.isWall(x, y) && playerAt(x, y) == null && pickupAt(x, y) == null) {
                pickups.add(new int[]{x, y});
                return;
            }
        }
    }

    // The last player alive, or null if the round isn't over.
    Player winner() {
        Player last = null;
        for (Player p : players) {
            if (!p.alive) continue;
            if (last != null) return null;
            last = p;
        }
        return last;
    }

    void reset(int[][] spawns) {
        burns.clear();
        pickups.clear();
        turn = 0;
        startTime = System.currentTimeMillis();
        for (int i = 0; i < players.size(); i++) {
            players.get(i).reset(spawns[i][0], spawns[i][1]);
        }
    }

    // Rush iff belief the opponent is empty beats L / (1 + L)
    static boolean shouldRush(double q, double lossRatio) {
        return q > lossRatio / (1 + lossRatio);
    }
}
