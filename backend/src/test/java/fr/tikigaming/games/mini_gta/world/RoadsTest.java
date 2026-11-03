package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.core.Rng;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Grid;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Roads : génération du réseau routier")
class RoadsTest {

    static RoadNetwork net;

    @BeforeAll
    static void arrange() {
        net = Roads.generate(new Rng(1337));
    }

    @Test
    void lesPremiersNoeudsFormentLaGrilleComplete() {
        int k = 0;
        for (double x : net.xs()) {
            for (double z : net.zs()) {
                RoadNode n = net.graph().nodes.get(k++);
                assertEquals(x, n.x);
                assertEquals(z, n.z);
            }
        }
    }

    @Test
    void lesLignesDeGrilleSontDesMetresEntiers() {
        for (double v : net.xs()) assertEquals(Math.rint(v), v);
        for (double v : net.zs()) assertEquals(Math.rint(v), v);
    }

    @Test
    void estDeterministe() {
        RoadNetwork again = Roads.generate(new Rng(1337));
        assertEquals(net.xs(), again.xs());
        assertEquals(net.graph().edges, again.graph().edges);
    }

    @Test
    void lesLignesDeGrilleSontEspaceesDe100A140m() {
        for (List<Double> lines : List.of(net.xs(), net.zs())) {
            for (int i = 1; i < lines.size() - 1; i++) {
                double gap = lines.get(i) - lines.get(i - 1);
                assertTrue(gap >= 100 && gap <= 141, "écart " + gap);
            }
            // La dernière ligne est la bordure, au moins 85 m après l'avant-dernière.
            assertTrue(lines.get(lines.size() - 1) - lines.get(lines.size() - 2) >= 85);
        }
        assertEquals(Grid.MIN_X, net.xs().get(0));
        assertEquals(Grid.MAX_Z, net.zs().get(net.zs().size() - 1));
    }

    @Test
    void uneLigneSurTroisEstUneAvenue() {
        for (int i = 0; i < net.kindX().size(); i++) {
            assertEquals(
                    i % 3 == 1 ? RoadKind.AVENUE : RoadKind.STREET, net.kindX().get(i));
        }
    }

    @Test
    void leGrapheEstConnexe() {
        RoadGraph g = net.graph();
        Set<Integer> seen = new HashSet<>(List.of(0));
        Deque<Integer> stack = new ArrayDeque<>(List.of(0));
        while (!stack.isEmpty()) {
            int n = stack.pop();
            for (int id : g.nodes.get(n).edges) {
                int o = g.other(g.edges.get(id), n).id;
                if (seen.add(o)) stack.push(o);
            }
        }
        assertEquals(g.nodes.size(), seen.size());
    }

    @Test
    void lesFeuxSontAuxCarrefoursDeLaGrilleUniquement() {
        for (RoadNode n : net.graph().nodes) {
            if (n.edges.size() < 3) {
                assertFalse(n.light);
                assertEquals(0, n.radius);
                continue;
            }
            boolean hill =
                    n.edges.stream().anyMatch(id -> net.graph().edges.get(id).kind() == RoadKind.HILL);
            assertEquals(!hill, n.light);
            assertEquals(!hill, n.square);
            assertTrue(n.lightOffset >= 0 && n.lightOffset < 26);
            double maxWidth = n.edges.stream()
                    .mapToDouble(id -> net.graph().edges.get(id).width())
                    .max()
                    .orElseThrow();
            assertEquals(maxWidth / 2, n.radius);
        }
    }

    @Test
    void troisMonteesEtDeuxRoutesDeCreteDansLesCollines() {
        assertEquals(5, net.hillLines().size());
        assertEquals(5, net.hillNodeIds().size());
        for (int k = 0; k < 5; k++) {
            assertEquals(
                    net.hillLines().get(k).points().size(),
                    net.hillNodeIds().get(k).size());
        }
        for (Polyline line : net.hillLines()) {
            for (Polyline.Point p : line.points()) assertTrue(p.z() <= WorldConstants.Ring.MIN_Z);
        }
    }

    @Test
    void laRouteDeLAerodromeEstUneImpasse() {
        RoadNode end = net.graph().nodes.get(net.airfieldEnd());
        assertEquals(1, end.edges.size());
        assertEquals(WorldConstants.Airfield.APRON_X - 25, end.x);
    }
}
