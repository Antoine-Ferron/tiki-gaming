package fr.tikigaming.games.mini_gta.world;

import fr.tikigaming.games.mini_gta.core.MathUtil;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.IntConsumer;

/** Index spatial et A* sur le graphe routier (GPS, police, conducteurs IA). */
public final class Navigation {
    private static final int CELL = 64;
    /** Vitesse optimiste (m/s) de l'heuristique : admissible tant qu'aucune route n'est plus rapide. */
    private static final double HEURISTIC_SPEED = 24;

    public record EdgeHit(RoadEdge edge, double t, double d) {}

    private final RoadGraph graph;
    private final Map<Long, List<Integer>> nodeCells = new HashMap<>();
    private final Map<Long, List<Integer>> edgeCells = new HashMap<>();

    public Navigation(RoadGraph graph) {
        this.graph = graph;
        for (RoadNode n : graph.nodes) cell(nodeCells, n.x, n.z).add(n.id);
        for (RoadEdge e : graph.edges) {
            RoadNode a = graph.nodes.get(e.a());
            RoadNode b = graph.nodes.get(e.b());
            int steps = (int) Math.ceil(e.length() / (CELL / 2.0)) + 1;
            Set<Long> seen = new HashSet<>();
            for (int k = 0; k <= steps; k++) {
                double t = (double) k / steps;
                double x = a.x + (b.x - a.x) * t;
                double z = a.z + (b.z - a.z) * t;
                if (seen.add(key(x, z))) cell(edgeCells, x, z).add(e.id());
            }
        }
    }

    public RoadGraph graph() {
        return graph;
    }

    private static long key(int cx, int cz) {
        return ((long) cx << 32) ^ (cz & 0xffffffffL);
    }

    private static long key(double x, double z) {
        return key((int) Math.floor(x / CELL), (int) Math.floor(z / CELL));
    }

    private static List<Integer> cell(Map<Long, List<Integer>> map, double x, double z) {
        return map.computeIfAbsent(key(x, z), k -> new ArrayList<>());
    }

    private static void around(Map<Long, List<Integer>> map, double x, double z, double radius, IntConsumer fn) {
        int r = (int) Math.ceil(radius / CELL);
        int cx = (int) Math.floor(x / CELL);
        int cz = (int) Math.floor(z / CELL);
        for (int i = -r; i <= r; i++) {
            for (int j = -r; j <= r; j++) {
                for (int id : map.getOrDefault(key(cx + i, cz + j), List.of())) fn.accept(id);
            }
        }
    }

    public Optional<RoadNode> nearestNode(double x, double z) {
        return nearestNode(x, z, 600);
    }

    /** Nœud le plus proche ; la zone de recherche double jusqu'à {@code maxRadius}. */
    public Optional<RoadNode> nearestNode(double x, double z, double maxRadius) {
        for (double radius = CELL; radius <= maxRadius; radius *= 2) {
            RoadNode[] best = {null};
            double[] bestD = {Double.POSITIVE_INFINITY};
            around(nodeCells, x, z, radius, id -> {
                RoadNode n = graph.nodes.get(id);
                double d = Math.hypot(n.x - x, n.z - z);
                if (d < bestD[0]) {
                    bestD[0] = d;
                    best[0] = n;
                }
            });
            if (best[0] != null) return Optional.of(best[0]);
        }
        return Optional.empty();
    }

    public Optional<EdgeHit> nearestEdge(double x, double z) {
        return nearestEdge(x, z, 300);
    }

    /** Point le plus proche du réseau routier. */
    public Optional<EdgeHit> nearestEdge(double x, double z, double maxRadius) {
        EdgeHit[] best = {null};
        for (double radius = CELL; radius <= maxRadius && best[0] == null; radius *= 2) {
            around(edgeCells, x, z, radius, id -> {
                RoadEdge e = graph.edges.get(id);
                RoadNode a = graph.nodes.get(e.a());
                RoadNode b = graph.nodes.get(e.b());
                MathUtil.SegmentHit h = MathUtil.pointSegment(x, z, a.x, a.z, b.x, b.z);
                if (best[0] == null || h.d() < best[0].d()) best[0] = new EdgeHit(e, h.t(), h.d());
            });
        }
        return Optional.ofNullable(best[0]);
    }

    /** Tronçons à moins de {@code maxR} du point et dont une extrémité est à au moins {@code minR}. */
    public List<RoadEdge> edgesInRing(double x, double z, double minR, double maxR) {
        Set<Integer> ids = new LinkedHashSet<>();
        around(edgeCells, x, z, maxR, ids::add);
        List<RoadEdge> out = new ArrayList<>();
        for (int id : ids) {
            RoadEdge e = graph.edges.get(id);
            RoadNode a = graph.nodes.get(e.a());
            RoadNode b = graph.nodes.get(e.b());
            double d = MathUtil.pointSegment(x, z, a.x, a.z, b.x, b.z).d();
            double far = Math.max(Math.hypot(a.x - x, a.z - z), Math.hypot(b.x - x, b.z - z));
            if (d <= maxR && far >= minR) out.add(e);
        }
        return out;
    }

    /** A* minimisant le temps de parcours ; renvoie les nœuds de {@code from} à {@code to}, ou une liste vide. */
    public List<Integer> findPath(int from, int to) {
        RoadNode goal = graph.nodes.get(to);
        MinHeap open = new MinHeap();
        Map<Integer, Double> gScore = new HashMap<>(Map.of(from, 0.0));
        Map<Integer, Integer> came = new HashMap<>();
        Set<Integer> closed = new HashSet<>();
        open.push(from, heuristic(from, goal));
        while (open.size() > 0) {
            int cur = open.pop();
            if (cur == to) return reconstruct(came, cur);
            if (!closed.add(cur)) continue;
            for (int eid : graph.nodes.get(cur).edges) {
                RoadEdge e = graph.edges.get(eid);
                int nb = e.a() == cur ? e.b() : e.a();
                double cost = gScore.get(cur) + e.length() / e.speed();
                if (cost < gScore.getOrDefault(nb, Double.POSITIVE_INFINITY)) {
                    gScore.put(nb, cost);
                    came.put(nb, cur);
                    open.push(nb, cost + heuristic(nb, goal));
                }
            }
        }
        return List.of();
    }

    private double heuristic(int id, RoadNode goal) {
        RoadNode n = graph.nodes.get(id);
        return Math.hypot(n.x - goal.x, n.z - goal.z) / HEURISTIC_SPEED;
    }

    static List<Integer> reconstruct(Map<Integer, Integer> came, int end) {
        List<Integer> path = new ArrayList<>(List.of(end));
        int c = end;
        while (came.containsKey(c)) {
            c = came.get(c);
            path.add(c);
        }
        Collections.reverse(path);
        return path;
    }

    public Optional<RoadEdge> edgeBetween(int a, int b) {
        for (int id : graph.nodes.get(a).edges) {
            RoadEdge e = graph.edges.get(id);
            if ((e.a() == a && e.b() == b) || (e.a() == b && e.b() == a)) return Optional.of(e);
        }
        return Optional.empty();
    }
}
