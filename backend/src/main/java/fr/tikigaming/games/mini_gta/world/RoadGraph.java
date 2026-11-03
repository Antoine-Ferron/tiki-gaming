package fr.tikigaming.games.mini_gta.world;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class RoadGraph {
    public final List<RoadNode> nodes = new ArrayList<>();
    public final List<RoadEdge> edges = new ArrayList<>();

    /** Suite de tronçons traversant des nœuds de degré 2, pour construire des rubans continus. */
    public record Chain(List<Integer> nodes, List<Integer> edges, RoadKind kind, double width, int lanes) {}

    private static final double LIGHT_CYCLE = 26;

    public RoadNode addNode(double x, double z) {
        RoadNode n = new RoadNode(nodes.size(), x, z);
        nodes.add(n);
        return n;
    }

    public RoadEdge addEdge(RoadNode a, RoadNode b, RoadKind kind) {
        RoadEdge e = new RoadEdge(
                edges.size(), a.id, b.id, kind, kind.lanes, kind.width, kind.speed, Math.hypot(b.x - a.x, b.z - a.z));
        edges.add(e);
        a.edges.add(e.id());
        b.edges.add(e.id());
        return e;
    }

    public RoadNode other(RoadEdge edge, int nodeId) {
        return nodes.get(edge.a() == nodeId ? edge.b() : edge.a());
    }

    /**
     * Point sur une voie. dir = +1 parcourt a→b, dir = -1 parcourt b→a ; s = distance dans le sens de
     * circulation. Circulation à droite : les voies sont décalées à droite du sens de marche.
     */
    public Vec3 lanePoint(RoadEdge edge, int dir, int lane, double s) {
        RoadNode from = nodes.get(dir == 1 ? edge.a() : edge.b());
        RoadNode to = nodes.get(dir == 1 ? edge.b() : edge.a());
        double dx = (to.x - from.x) / edge.length();
        double dz = (to.z - from.z) / edge.length();
        double off = (lane + 0.5) * WorldConstants.LANE_WIDTH;
        double t = s / edge.length();
        return new Vec3(from.x + dx * s - dz * off, from.y + (to.y - from.y) * t, from.z + dz * s + dx * off);
    }

    /** Direction unitaire de circulation sur un tronçon. */
    public Vec2 direction(RoadEdge edge, int dir) {
        RoadNode from = nodes.get(dir == 1 ? edge.a() : edge.b());
        RoadNode to = nodes.get(dir == 1 ? edge.b() : edge.a());
        return new Vec2((to.x - from.x) / edge.length(), (to.z - from.z) / edge.length());
    }

    /**
     * État du feu pour un véhicule arrivant sur {@code node} par {@code edge}. Cycle de 26 s :
     * 0-10 vert EO, 10-12 orange EO, 12-13 tout rouge, 13-23 vert NS, 23-25 orange NS, 25-26 tout rouge.
     */
    public LightState lightState(RoadNode node, RoadEdge edge, double time) {
        if (!node.light) return LightState.GREEN;
        RoadNode o = other(edge, node.id);
        boolean ew = Math.abs(o.x - node.x) > Math.abs(o.z - node.z);
        double t = (time + node.lightOffset) % LIGHT_CYCLE;
        if (ew) return t < 10 ? LightState.GREEN : t < 12 ? LightState.YELLOW : LightState.RED;
        if (t >= 13 && t < 23) return LightState.GREEN;
        return t >= 23 && t < 25 ? LightState.YELLOW : LightState.RED;
    }

    public List<Chain> chains() {
        Set<Integer> visited = new HashSet<>();
        List<Chain> out = new ArrayList<>();
        for (RoadNode n : nodes) {
            if (!isJoint(n)) continue;
            for (int id : n.edges) {
                if (!visited.contains(id)) out.add(walk(n, edges.get(id), visited));
            }
        }
        // Boucles pures et changements de type sur des nœuds de degré 2.
        for (RoadEdge e : edges) {
            if (!visited.contains(e.id())) out.add(walk(nodes.get(e.a()), e, visited));
        }
        return out;
    }

    private static boolean isJoint(RoadNode n) {
        return n.edges.size() != 2;
    }

    private Chain walk(RoadNode start, RoadEdge firstEdge, Set<Integer> visited) {
        List<Integer> chainNodes = new ArrayList<>(List.of(start.id));
        List<Integer> chainEdges = new ArrayList<>();
        RoadEdge edge = firstEdge;
        RoadNode node = start;
        for (; ; ) {
            visited.add(edge.id());
            chainEdges.add(edge.id());
            node = other(edge, node.id);
            chainNodes.add(node.id);
            if (isJoint(node) || node.id == start.id) break;
            RoadEdge next = null;
            for (int id : node.edges) {
                if (id != edge.id()) {
                    next = edges.get(id);
                    break;
                }
            }
            if (next == null || visited.contains(next.id()) || next.kind() != edge.kind()) break;
            edge = next;
        }
        return new Chain(chainNodes, chainEdges, firstEdge.kind(), firstEdge.width(), firstEdge.lanes());
    }
}
