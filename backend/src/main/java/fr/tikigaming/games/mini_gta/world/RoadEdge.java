package fr.tikigaming.games.mini_gta.world;

/** Tronçon de route entre deux nœuds. */
public record RoadEdge(int id, int a, int b, RoadKind kind, int lanes, double width, double speed, double length) {}
