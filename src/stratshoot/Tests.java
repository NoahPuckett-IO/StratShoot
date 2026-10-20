package stratshoot;

// Run this after each task. Every line should say PASS.
public class Tests {
    static void check(String name, boolean ok) {
        System.out.println((ok ? "PASS " : "FAIL ") + name);
    }

    public static void main(String[] args) {
        Game g = new Game();
        Player a = new Player("Ann", 1, 1), b = new Player("Bo", 3, 1);

        check("1 canAct", a.canAct(0));
        check("2 floor shot", g.fireFloor(a, 0) && a.ammo == 1);
        check("2 lockout", !g.fireFloor(a, 100));
        check("3 kill", g.fireAt(a, b, 5000) && !b.alive && a.ammo == 0);
        check("3 empty", !g.fireAt(a, b, 9000));
        check("4 rush", Game.shouldRush(0.8, 3) && !Game.shouldRush(0.7, 3));
        Board bd = new Board(5, 3);
        check("5 border", bd.walls[0][0] == '#' && bd.walls[1][1] == '.');
        check("6 render", bd.render(java.util.List.of(a)).startsWith("#####\n#A"));
        Board lb = new Board(7, 5);
        lb.addWall(3, 1, 1, 3);
        check("7 wall blocks sight", !lb.canSee(1, 2, 5, 2));
        check("7 open sight", lb.canSee(1, 1, 2, 3));
        check("8 corner tile", Renderer.wall(lb, 0, 0).equals("+-"));
    }
}
