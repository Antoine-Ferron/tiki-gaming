package fr.tikigaming.games.mini_gta.world;

public record Rect(double x0, double x1, double z0, double z1) {
    public double width() {
        return x1 - x0;
    }

    public double depth() {
        return z1 - z0;
    }
}
