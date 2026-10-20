package stratshoot;

public class Player {
    public static final int MAX_AMMO = 2;
    final String name;
    int x, y;
    int ammo = MAX_AMMO;
    boolean alive = true;
    long lockoutUntil = 0;
    long scorchUntil = 0;
    int fx =1, fy = 0;
    int floorShots = 0;
    int pickups = 0;
    int wins = 0;

    Player(String name, int x, int y) {
        this.name = name;
        this.x =x;
        this.y =y;
    }

    boolean canAct(long now){
        return alive && now >= lockoutUntil;
    }

    //fresh round: back to spawn, full ammo. Wins carry
    void reset(int x, int y){
        this.x = x;
        this. y = y;
        ammo = MAX_AMMO;
        alive = true;
        lockoutUntil = 0;
        scorchUntil = 0;
        floorShots = 0;
        pickups = 0;
    }
}
