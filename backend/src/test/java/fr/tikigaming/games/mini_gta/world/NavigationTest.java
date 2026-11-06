package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Graphe de test minimal (Arrange) :
 *
 * <pre>
 *   0 ──street── 1 ──street── 2
 *   │                         │
 *   └──────── highway ────────┘ (détour par 3 et 4, plus long mais plus rapide)
 *   5 ── 6 : composante isolée
 * </pre>
 */
@DisplayName("Navigation : index spatial et A* routier")
class NavigationTest {

    RoadGraph g;
    Navigation nav;

    @BeforeEach
    void arrange() {
        g = new RoadGraph();
        RoadNode n0 = g.addNode(0, 0);
        RoadNode n1 = g.addNode(200, 0);
        RoadNode n2 = g.addNode(400, 0);
        RoadNode n3 = g.addNode(0, 100);
        RoadNode n4 = g.addNode(400, 100);
        RoadNode n5 = g.addNode(2000, 2000);
        RoadNode n6 = g.addNode(2100, 2000);
        g.addEdge(n0, n1, RoadKind.STREET); // e0 : 200 m à 13 m/s
        g.addEdge(n1, n2, RoadKind.STREET); // e1
        g.addEdge(n0, n3, RoadKind.HIGHWAY); // e2 : 100 m à 24 m/s
        g.addEdge(n3, n4, RoadKind.HIGHWAY); // e3 : 400 m
        g.addEdge(n4, n2, RoadKind.HIGHWAY); // e4 : 100 m
        g.addEdge(n5, n6, RoadKind.STREET); // e5
        nav = new Navigation(g);
    }

    @Nested
    class FindPath {
        @Test
        void minimiseLeTempsDeParcoursPasLaDistance() {
            // Rue : 400 / 13 ≈ 30,8 s ; autoroute : 600 / 24 = 25 s.
            assertEquals(List.of(0, 3, 4, 2), nav.findPath(0, 2));
        }

        @Test
        void cheminTrivialQuandDepartEgalArrivee() {
            assertEquals(List.of(1), nav.findPath(1, 1));
        }

        @Test
        void renvoieUneListeVideSiInaccessible() {
            assertEquals(List.of(), nav.findPath(0, 6));
        }

        @Test
        void chaqueEtapeEstRelieeParUnTroncon() {
            List<Integer> path = nav.findPath(1, 3);
            assertEquals(1, path.getFirst());
            assertEquals(3, path.getLast());
            for (int k = 0; k < path.size() - 1; k++) {
                assertTrue(nav.edgeBetween(path.get(k), path.get(k + 1)).isPresent());
            }
        }
    }

    @Nested
    class NearestNode {
        @Test
        void trouveLeNoeudLePlusProche() {
            assertEquals(1, nav.nearestNode(190, 10).orElseThrow().id);
        }

        @Test
        void elargitLaRechercheSiLaCelluleEstVide() {
            // Aucun nœud à moins de 64 m de (200, 300) : la recherche s'étend.
            assertEquals(3, nav.nearestNode(100, 300).orElseThrow().id);
        }

        @Test
        void rienAuDelaDuRayonMaximal() {
            assertTrue(nav.nearestNode(1000, 1000, 300).isEmpty());
        }

        @Test
        void unRayonDUneCelluleCouvreLesCellulesVoisines() {
            // Cellules de 64 m : (190, 0) et (200, -10) sont dans la cellule voisine du nœud 1 (200, 0), en x puis
            // en z. Un rayon maximal d'exactement une cellule suffit à le trouver.
            assertEquals(1, nav.nearestNode(190, 0, 64).orElseThrow().id);
            assertEquals(1, nav.nearestNode(200, -10, 64).orElseThrow().id);
        }
    }

    @Nested
    class NearestEdge {
        @Test
        void projeteSurLeTronconLePlusProche() {
            Navigation.EdgeHit hit = nav.nearestEdge(100, 3).orElseThrow();
            assertEquals(0, hit.edge().id());
            assertEquals(0.5, hit.t(), 1e-9);
            assertEquals(3, hit.d(), 1e-9);
        }

        @Test
        void rienAuDelaDuRayonMaximal() {
            assertTrue(nav.nearestEdge(1000, 1000, 100).isEmpty());
        }

        @Test
        void unLongTronconEstTrouveLoinDeSesExtremites() {
            // (200, 103) : le milieu de l'autoroute e3 (400 m), à plus de deux cellules de ses deux extrémités.
            Navigation.EdgeHit hit = nav.nearestEdge(200, 103, 64).orElseThrow();
            assertEquals(3, hit.edge().id());
            assertEquals(3, hit.d(), 1e-9);
        }

        @Test
        void leTronconLePlusProcheGagneParmiPlusieurs() {
            // (150, 40) : e0 à 40 m, e3 à 60 m, tous deux dans la zone de recherche.
            Navigation.EdgeHit hit = nav.nearestEdge(150, 40).orElseThrow();
            assertEquals(0, hit.edge().id());
            assertEquals(40, hit.d(), 1e-9);
        }
    }

    @Test
    void edgesInRingFiltreParDistanceMinEtMax() {
        // Depuis (200, 0), maxR = 150 : e0, e1 (d = 0) et e3 (d = 100) sont assez proches ; e2 et e4
        // (d = 200) sont trop loin. Toutes leurs extrémités lointaines dépassent minR = 150.
        List<Integer> ids = nav.edgesInRing(200, 0, 150, 150).stream()
                .map(RoadEdge::id)
                .sorted()
                .toList();
        assertEquals(List.of(0, 1, 3), ids);
        // minR = 250 : l'extrémité la plus lointaine de chacun est à moins de 250 m.
        assertTrue(nav.edgesInRing(200, 0, 250, 150).isEmpty());
    }

    @Test
    void edgesInRingInclutSesDeuxFrontieres() {
        // Depuis (200, 0) : e3 est exactement à maxR = 100 ; l'extrémité lointaine de e0 et de e1 est exactement à
        // minR = 200. Les trois sont gardés (bornes incluses).
        List<Integer> ids = nav.edgesInRing(200, 0, 200, 100).stream()
                .map(RoadEdge::id)
                .sorted()
                .toList();
        assertEquals(List.of(0, 1, 3), ids);
    }

    @Test
    void edgeBetweenDansLesDeuxSens() {
        assertEquals(0, nav.edgeBetween(0, 1).orElseThrow().id());
        assertEquals(0, nav.edgeBetween(1, 0).orElseThrow().id());
        assertTrue(nav.edgeBetween(0, 2).isEmpty());
    }
}
