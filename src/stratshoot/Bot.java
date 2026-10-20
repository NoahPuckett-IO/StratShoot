package stratshoot;

//Plays a seat using the rush rule from the design.
public class Bot {
    static final double LOSS_RATIO=3;

    // Belief the opponent is empty, using only public info:
    // everyone starts with 2, floor shots are seen, pickups are seen.
    static double beliefEmpty(Player opp) {
        int maxAmmo = Math.min(Player.MAX_AMMO, Player.MAX_AMMO - opp.floorShots + opp.pickups);
        if (maxAmmo <= 0) return 1.0;
        if (maxAmmo == 1) return 0.4;
        return 0.1;
    }

    // Returns the same one-letter command a human would type.
    static char decide(Game game, Board b, Player me, Player opp) {
        if (me.ammo > 0 && b.canSee(me.x, me.y, opp.x, opp.y)) return 'x';
        if (me.ammo < Player.MAX_AMMO && !game.pickups.isEmpty()) {
            return stepToward(game, b, me, nearestPickup(game, me));
        }
        if (me.ammo > 0 && Game.shouldRush(beliefEmpty(opp), LOSS_RATIO)) {
            return stepToward(game, b, me, new int[]{opp.x, opp.y});
        }
        if (me.ammo == Player.MAX_AMMO && me.floorShots == 0) return 'f';
        return 'p';
    }

    static char stepToward(Game game, Board b, Player me, int[] target) {
        if (target == null) return 'p';
        int dx = Integer.signum(target[0] - me.x);
        int dy = Integer.signum(target[1] - me.y);
        if (dx != 0 && !b.isWall(me.x + dx, me.y) && game.playerAt(me.x + dx, me.y) == null) {
            return dx > 0 ? 'd' : 'a';
        }
        if (dy != 0 && !b.isWall(me.x, me.y + dy) && game.playerAt(me.x, me.y + dy) == null) {
            return dy > 0 ? 's' : 'w';
        }
        return "wasd".charAt(game.rng.nextInt(4));
    }

    static int[] nearestPickup(Game game, Player me) {
        int[] best = null;
        int bestDist = Integer.MAX_VALUE;
        for (int[] k : game.pickups {
            int d = Math.abs(k[0] - me.x) + Math.abs(k[1] - me.y);
            if (d < bestDist) {
                bestDist = d;
                best = k;
            }
        }
        return best;
    }
}
