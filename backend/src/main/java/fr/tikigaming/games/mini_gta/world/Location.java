package fr.tikigaming.games.mini_gta.world;

/** Point remarquable ; {@code heading} est nul quand l'orientation est libre. */
public record Location(double x, double y, double z, Double heading) {
    public Location(double x, double y, double z) {
        this(x, y, z, null);
    }
}
