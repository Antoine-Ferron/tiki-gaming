package fr.tikigaming.games.mini_gta.world;

import fr.tikigaming.games.mini_gta.core.Rng;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Airfield;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Grid;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Ring;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.DoubleFunction;

/** Génération du réseau routier : grille, périphérique, bretelles, routes de colline, aérodrome. */
public final class Roads {
    private Roads() {}

    static List<Double> gridLines(double min, double max, Rng rng) {
        List<Double> out = new ArrayList<>(List.of(min));
        double v = min;
        for (; ; ) {
            v += rng.range(100, 140);
            if (v > max - 85) break;
            out.add((double) Math.round(v));
        }
        out.add(max);
        return out;
    }

    public static RoadNetwork generate(Rng rng) {
        Rng r = rng.fork("roads");
        RoadGraph g = new RoadGraph();
        List<Double> xs = gridLines(Grid.MIN_X, Grid.MAX_X, r);
        List<Double> zs = gridLines(Grid.MIN_Z, Grid.MAX_Z, r);
        List<RoadKind> kindX = new ArrayList<>();
        for (int i = 0; i < xs.size(); i++) kindX.add(i % 3 == 1 ? RoadKind.AVENUE : RoadKind.STREET);
        List<RoadKind> kindZ = new ArrayList<>();
        for (int j = 0; j < zs.size(); j++) kindZ.add(j % 3 == 1 ? RoadKind.AVENUE : RoadKind.STREET);

        // Grille
        RoadNode[][] grid = new RoadNode[xs.size()][zs.size()];
        for (int i = 0; i < xs.size(); i++) {
            for (int j = 0; j < zs.size(); j++) grid[i][j] = g.addNode(xs.get(i), zs.get(j));
        }
        for (int i = 0; i < xs.size(); i++) {
            for (int j = 0; j < zs.size(); j++) {
                if (i + 1 < xs.size()) g.addEdge(grid[i][j], grid[i + 1][j], kindZ.get(j));
                if (j + 1 < zs.size()) g.addEdge(grid[i][j], grid[i][j + 1], kindX.get(i));
            }
        }

        // Périphérique (rectangle arrondi), avec un nœud de jonction face à chaque ligne de la grille.
        double rr = Ring.RADIUS;
        List<RoadNode> ring = new ArrayList<>();
        Map<String, RoadNode> junction = new HashMap<>();
        addArc(g, ring, Ring.MIN_X + rr, Ring.MIN_Z + rr, Math.PI); // NO
        addSide(ring, junction, "n", xs, x -> g.addNode(x, Ring.MIN_Z));
        addArc(g, ring, Ring.MAX_X - rr, Ring.MIN_Z + rr, Math.PI * 1.5); // NE
        addSide(ring, junction, "e", zs, z -> g.addNode(Ring.MAX_X, z));
        addArc(g, ring, Ring.MAX_X - rr, Ring.MAX_Z - rr, 0); // SE
        addSide(ring, junction, "s", xs.reversed(), x -> g.addNode(x, Ring.MAX_Z));
        addArc(g, ring, Ring.MIN_X + rr, Ring.MAX_Z - rr, Math.PI / 2); // SO
        addSide(ring, junction, "w", zs.reversed(), z -> g.addNode(Ring.MIN_X, z));
        for (int k = 0; k < ring.size(); k++) g.addEdge(ring.get(k), ring.get((k + 1) % ring.size()), RoadKind.HIGHWAY);

        // Bretelles entre la bordure de la grille et le périphérique.
        for (int i = 0; i < xs.size(); i++) {
            g.addEdge(grid[i][0], junction.get(key("n", xs.get(i))), kindX.get(i));
            g.addEdge(grid[i][zs.size() - 1], junction.get(key("s", xs.get(i))), kindX.get(i));
        }
        for (int j = 0; j < zs.size(); j++) {
            g.addEdge(grid[0][j], junction.get(key("w", zs.get(j))), kindZ.get(j));
            g.addEdge(grid[xs.size() - 1][j], junction.get(key("e", zs.get(j))), kindZ.get(j));
        }

        // Routes de colline : trois montées sinueuses depuis le nord, reliées par une route de crête.
        List<Polyline> hillLines = new ArrayList<>();
        List<List<Integer>> hillNodeIds = new ArrayList<>();
        double width = RoadKind.HILL.width;
        double[] starts = {closest(xs, -430), closest(xs, 10), closest(xs, 420)};
        List<RoadNode> tops = new ArrayList<>();
        for (double x0 : starts) {
            double amp = r.range(30, 55);
            double phase = r.range(0, Math.PI * 2);
            double freq = r.range(0.01, 0.016);
            List<Polyline.Point> pts = new ArrayList<>();
            for (double z = Ring.MIN_Z; z >= WorldConstants.HILL_TOP_Z; z -= 25) {
                double k = Ring.MIN_Z - z;
                pts.add(new Polyline.Point(x0 + amp * (Math.sin(k * freq + phase) - Math.sin(phase)), z));
            }
            List<Integer> ids = new ArrayList<>(List.of(junction.get(key("n", x0)).id));
            for (int k = 1; k < pts.size(); k++) {
                RoadNode n = g.addNode(pts.get(k).x(), pts.get(k).z());
                g.addEdge(g.nodes.get(ids.getLast()), n, RoadKind.HILL);
                ids.add(n.id);
            }
            tops.add(g.nodes.get(ids.getLast()));
            hillLines.add(new Polyline(pts, width));
            hillNodeIds.add(ids);
        }
        for (int k = 0; k < tops.size() - 1; k++) {
            RoadNode a = tops.get(k);
            RoadNode b = tops.get(k + 1);
            double len = Math.hypot(b.x - a.x, b.z - a.z);
            long segs = Math.max(2, Math.round(len / 25));
            double wig = r.range(20, 35);
            List<Polyline.Point> pts = new ArrayList<>(List.of(new Polyline.Point(a.x, a.z)));
            List<Integer> ids = new ArrayList<>(List.of(a.id));
            for (int s = 1; s < segs; s++) {
                double t = (double) s / segs;
                Polyline.Point p =
                        new Polyline.Point(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t - wig * Math.sin(Math.PI * t));
                pts.add(p);
                RoadNode n = g.addNode(p.x(), p.z());
                g.addEdge(g.nodes.get(ids.getLast()), n, RoadKind.HILL);
                ids.add(n.id);
            }
            pts.add(new Polyline.Point(b.x, b.z));
            g.addEdge(g.nodes.get(ids.getLast()), b, RoadKind.HILL);
            ids.add(b.id);
            hillLines.add(new Polyline(pts, width));
            hillNodeIds.add(ids);
        }

        // Route de l'aérodrome (impasse sur l'aire de stationnement).
        double zAir = closest(zs, Airfield.APRON_Z);
        RoadNode air = g.addNode(Airfield.APRON_X - 25, zAir);
        g.addEdge(junction.get(key("e", zAir)), air, RoadKind.STREET);

        // Intersections et feux.
        for (RoadNode n : g.nodes) {
            if (n.edges.size() < 3) continue;
            List<RoadEdge> es = n.edges.stream().map(g.edges::get).toList();
            n.radius = es.stream().mapToDouble(RoadEdge::width).max().orElseThrow() / 2;
            n.square = es.stream().allMatch(e -> e.kind() != RoadKind.HILL);
            n.light = n.square;
            n.lightOffset = r.range(0, 26);
        }

        return new RoadNetwork(
                g,
                List.copyOf(xs),
                List.copyOf(zs),
                List.copyOf(kindX),
                List.copyOf(kindZ),
                List.copyOf(hillLines),
                List.copyOf(hillNodeIds),
                air.id);
    }

    private static String key(String side, double v) {
        return side + ":" + v;
    }

    /** Valeur de la liste la plus proche de la cible (la première en cas d'égalité). */
    static double closest(List<Double> values, double target) {
        double best = values.get(0);
        for (double v : values) {
            if (Math.abs(v - target) < Math.abs(best - target)) best = v;
        }
        return best;
    }

    private static void addArc(RoadGraph g, List<RoadNode> ring, double cx, double cz, double a0) {
        for (int k = 0; k <= 6; k++) {
            double a = a0 + (k / 6.0) * (Math.PI / 2);
            ring.add(g.addNode(cx + Ring.RADIUS * Math.cos(a), cz + Ring.RADIUS * Math.sin(a)));
        }
    }

    private static void addSide(
            List<RoadNode> ring,
            Map<String, RoadNode> junction,
            String side,
            List<Double> values,
            DoubleFunction<RoadNode> make) {
        for (double v : values) {
            RoadNode n = make.apply(v);
            ring.add(n);
            junction.put(key(side, v), n);
        }
    }
}
