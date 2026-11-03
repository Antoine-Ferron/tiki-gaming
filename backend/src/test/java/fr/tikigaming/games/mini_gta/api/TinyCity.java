package fr.tikigaming.games.mini_gta.api;

import fr.tikigaming.games.mini_gta.world.Block;
import fr.tikigaming.games.mini_gta.world.Building;
import fr.tikigaming.games.mini_gta.world.CityData;
import fr.tikigaming.games.mini_gta.world.District;
import fr.tikigaming.games.mini_gta.world.Location;
import fr.tikigaming.games.mini_gta.world.Locations;
import fr.tikigaming.games.mini_gta.world.RoadGraph;
import fr.tikigaming.games.mini_gta.world.RoadKind;
import fr.tikigaming.games.mini_gta.world.RoadNetwork;
import fr.tikigaming.games.mini_gta.world.RoadNode;
import fr.tikigaming.games.mini_gta.world.SidewalkNode;
import fr.tikigaming.games.mini_gta.world.Terrain;
import java.util.List;

/**
 * Ville miniature construite à la main (jeu de données de test) : un carré de quatre rues, un
 * îlot, un trottoir. Le relief est plat grâce à un bruit constant.
 */
final class TinyCity {
    private TinyCity() {}

    static CityData create(long seed) {
        return build(seed, true);
    }

    /** Même ville, sans aucune rue : le GPS n'a pas de nœud de départ. */
    static CityData withoutRoads(long seed) {
        return build(seed, false);
    }

    private static CityData build(long seed, boolean withRoads) {
        RoadGraph g = new RoadGraph();
        if (!withRoads) return city(seed, g);
        RoadNode a = g.addNode(0, 0);
        RoadNode b = g.addNode(200, 0);
        RoadNode c = g.addNode(200, 200);
        RoadNode d = g.addNode(0, 200);
        g.addEdge(a, b, RoadKind.STREET);
        g.addEdge(b, c, RoadKind.AVENUE);
        g.addEdge(c, d, RoadKind.STREET);
        g.addEdge(d, a, RoadKind.STREET);
        return city(seed, g);
    }

    private static CityData city(long seed, RoadGraph g) {
        RoadNetwork roads = new RoadNetwork(
                g,
                List.of(0.0, 200.0),
                List.of(0.0, 200.0),
                List.of(RoadKind.STREET, RoadKind.STREET),
                List.of(RoadKind.STREET, RoadKind.AVENUE),
                List.of(),
                List.of(),
                0);
        Location here = new Location(100, 0.15, 10, Math.PI);
        Locations locations = new Locations(
                here,
                here,
                new Location(100, 0.15, 20),
                new Location(150, 0, 5, 0.0),
                here,
                here,
                new Location(60, 0.15, 6),
                here,
                here,
                here,
                here,
                here,
                List.of(
                        new Location(10, 0.15, 10),
                        new Location(20, 0.15, 20),
                        new Location(30, 0.15, 30),
                        new Location(40, 0.15, 40)),
                List.of(new Location(0, 0.15, 0), new Location(110, 0.15, 0), new Location(90, 0, 9, 0.0)));
        SidewalkNode s = new SidewalkNode(0, 8, 8, 0.15);
        return new CityData(
                seed,
                new Terrain((x, y) -> 0),
                roads,
                List.of(new Block(0, 6, 194, 6, 194, District.SUBURB, false, 0, 0)),
                List.<Building>of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(s),
                locations,
                List.of());
    }
}
