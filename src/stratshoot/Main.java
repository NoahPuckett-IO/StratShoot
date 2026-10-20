package stratshoot;

import java.util.Scanner;

public class Main {
    static final int[][] SPAWNS = {{2, 2}, {17, 7}};

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        Rules.show();
        System.out.print("Play against the bot? (y/n) ");
        boolean vsBot = in.nextLine().trim().equalsIgnoreCase("y");

        Board board = new Board(20, 10);
        board.addWall(6, 3, 2, 3);
        board.addWall(12, 4, 3, 1);
        board.addWall(10, 7, 1, 1);

        Game game = new Game();
        Player noah = new Player("Noah", 2, 2);
        Player hruss = new Player(vsBot ? "Bot" : "Hruss", 17, 7);
        game.players.add(noah);
        game.players.add(hruss);

        while (true) {
            game.reset(SPAWNS);
            Player winner = playRound(game, board, in, vsBot);
            if (winner == null) break;
            winner.wins++;
            System.out.println(Renderer.render(game, board, null));
            System.out.println(winner.name + " wins the round!  Score: "
                    + noah.name + " " + noah.wins + " - " + hruss.wins + " " + hruss.name);
            System.out.print("Play again? (y/n) ");
            if (!in.nextLine().trim().equalsIgnoreCase("y")) break;
        }
    }

    // Returns the winner, or null if someone quit.
    static Player playRound(Game game, Board board, Scanner in, boolean vsBot) {
        while (true) {
            Player p = game.players.get(game.turn % 2);
            Player other = game.players.get((game.turn + 1) % 2);
            char cmd;
            if (vsBot && p == game.players.get(1)) {
                cmd = Bot.decide(game, board, p, other);
                System.out.println(p.name + " acts.");
            } else {
                if (!vsBot) handOff(p, in);
                System.out.println(Renderer.render(game, board, p));
                System.out.println(p.name + "'s turn.  Your ammo: " + p.ammo);
                System.out.print("w/a/s/d move, f floor shot, x shoot, p pass, q quit > ");
                String line = in.nextLine().trim();
                if (line.isEmpty()) continue;
                cmd = line.charAt(0);
            }
            if (cmd == 'q') return null;
            act(game, board, p, other, cmd);
            Player w = game.winner();
            if (w != null) return w;
            game.endTurn(board);
        }
    }

    static void act(Game game, Board board, Player p, Player other, char cmd) {
        long now = System.currentTimeMillis();
        switch (cmd) {
            case 'w' -> game.move(p, board, 0, -1);
            case 's' -> game.move(p, board, 0, 1);
            case 'a' -> game.move(p, board, -1, 0);
            case 'd' -> game.move(p, board, 1, 0);
            case 'f' -> game.fireFloor(p, now);
            case 'x' -> {
                if (board.canSee(p.x, p.y, other.x, other.y)) game.fireAt(p, other, now);
            }
            default -> { }
        }
    }

    // Push the last view off screen so the next player can't peek.
    static void handOff(Player next, Scanner in) {
        for (int i = 0; i < 40; i++) System.out.println();
        System.out.print("Pass to " + next.name + ", then press Enter...");
        in.nextLine();
    }
}