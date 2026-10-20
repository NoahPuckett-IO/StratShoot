package stratshoot;

public class Rules {
    static void show() {
        System.out.println("""
                ------------------- STRATSHOOT -----------------
                Walls block shots, so you shoot what you see.
                
                FLOOR SHOT (f): wastes a bullet but proves you're armed.
                  2 bullets -> you're still armed. Scary.
                  1 bullet  -> you just emptied yourself. Bad idea.
                A quiet player is either empty or holding. Your call.
                
                AMMO (o): spawns every few turns. Max 2.
                SCORCH (, *): every floor shot leaves a mark. Important.
                
                Take turns. One action per turn:
                  w a s d = move   f = floor shot   x = shoot
                  p = pass         q = quit
                ------------------------------------------------------
                """);
    }
}