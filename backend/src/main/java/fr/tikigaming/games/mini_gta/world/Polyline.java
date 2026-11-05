package fr.tikigaming.games.mini_gta.world;

import java.util.List;

public record Polyline(List<Point> points, double width) {
    public record Point(double x, double z) {}
}
