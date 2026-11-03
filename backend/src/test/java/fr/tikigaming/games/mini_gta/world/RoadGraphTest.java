package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("RoadGraph : graphe routier, voies et feux")
class RoadGraphTest {

    private static final double EPS = 1e-9;

    @Nested
    class Construction {
        @Test
        void addEdgeCalculeLongueurEtSpecsEtRelieLesNoeuds() {
            RoadGraph g = new RoadGraph();
            RoadNode a = g.addNode(0, 0);
            RoadNode b = g.addNode(30, 40);
            RoadEdge e = g.addEdge(a, b, RoadKind.AVENUE);
            assertEquals(50, e.length(), EPS);
            assertEquals(2, e.lanes());
            assertEquals(19, e.width(), EPS);
            assertEquals(List.of(0), a.edges);
            assertEquals(List.of(0), b.edges);
            assertSame(b, g.other(e, a.id));
            assertSame(a, g.other(e, b.id));
        }

        @Test
        void lesIdentifiantsSuiventLOrdreDInsertion() {
            RoadGraph g = new RoadGraph();
            assertEquals(0, g.addNode(0, 0).id);
            assertEquals(1, g.addNode(1, 0).id);
            assertEquals(2, g.nodes.size());
        }
    }

    @Nested
    @DisplayName("lanePoint : circulation à droite")
    class Lanes {
        RoadGraph g;
        RoadEdge e;

        @BeforeEach
        void arrange() {
            // Route vers l'est, de (0,0) à (100,0), la seconde extrémité 10 m plus haut.
            g = new RoadGraph();
            RoadNode a = g.addNode(0, 0);
            RoadNode b = g.addNode(100, 0);
            b.y = 10;
            e = g.addEdge(a, b, RoadKind.AVENUE);
        }

        @Test
        void sensDirectVoieZeroEstDecaleeADroite() {
            // Vers l'est (+X), la droite est +Z (sud) : décalage de 0,5 voie.
            Vec3 p = g.lanePoint(e, 1, 0, 25);
            assertEquals(25, p.x(), EPS);
            assertEquals(0.5 * WorldConstants.LANE_WIDTH, p.z(), EPS);
            assertEquals(2.5, p.y(), EPS);
        }

        @Test
        void sensInverseVoieUnEstDecaleeDeLAutreCote() {
            Vec3 p = g.lanePoint(e, -1, 1, 25);
            assertEquals(75, p.x(), EPS);
            assertEquals(-1.5 * WorldConstants.LANE_WIDTH, p.z(), EPS);
            assertEquals(7.5, p.y(), EPS);
        }

        @Test
        void directionUnitaire() {
            assertEquals(new Vec2(1, 0), g.direction(e, 1));
            assertEquals(new Vec2(-1, 0), g.direction(e, -1));
        }
    }

    @Nested
    @DisplayName("lightState : cycle de 26 s (valeurs limites)")
    class Lights {
        RoadGraph g;
        RoadNode center;
        RoadEdge fromEast;
        RoadEdge fromSouth;

        @BeforeEach
        void arrange() {
            g = new RoadGraph();
            center = g.addNode(0, 0);
            fromEast = g.addEdge(center, g.addNode(100, 0), RoadKind.STREET);
            fromSouth = g.addEdge(center, g.addNode(0, 100), RoadKind.STREET);
            center.light = true;
        }

        @ParameterizedTest(name = "axe est-ouest, t = {0} -> {1}")
        @CsvSource({
            "0, GREEN",
            "9.999, GREEN",
            "10, YELLOW",
            "11.999, YELLOW",
            "12, RED",
            "25.999, RED",
            "26, GREEN",
        })
        void axeEstOuest(double t, LightState expected) {
            assertEquals(expected, g.lightState(center, fromEast, t));
        }

        @ParameterizedTest(name = "axe nord-sud, t = {0} -> {1}")
        @CsvSource({
            "12.999, RED",
            "13, GREEN",
            "22.999, GREEN",
            "23, YELLOW",
            "24.999, YELLOW",
            "25, RED",
            "0, RED",
        })
        void axeNordSud(double t, LightState expected) {
            assertEquals(expected, g.lightState(center, fromSouth, t));
        }

        @Test
        void lesDeuxAxesNeSontJamaisVertsEnMemeTemps() {
            for (double t = 0; t < 26; t += 0.05) {
                boolean ew = g.lightState(center, fromEast, t) == LightState.GREEN;
                boolean ns = g.lightState(center, fromSouth, t) == LightState.GREEN;
                assertEquals(false, ew && ns, "t = " + t);
            }
        }

        @Test
        void ledecalageDePhaseEstApplique() {
            center.lightOffset = 13;
            assertEquals(LightState.GREEN, g.lightState(center, fromSouth, 0));
        }

        @Test
        void sansFeuToujoursVert() {
            center.light = false;
            assertEquals(LightState.GREEN, g.lightState(center, fromSouth, 0));
        }
    }

    @Nested
    @DisplayName("chains : rubans continus à travers les nœuds de degré 2")
    class Chains {
        @Test
        void uneIntersectionEnTDonneTroisRubans() {
            RoadGraph g = new RoadGraph();
            RoadNode c = g.addNode(0, 0);
            RoadNode bend = g.addNode(50, 0);
            g.addEdge(c, bend, RoadKind.STREET);
            g.addEdge(bend, g.addNode(50, 50), RoadKind.STREET);
            g.addEdge(c, g.addNode(-50, 0), RoadKind.STREET);
            g.addEdge(c, g.addNode(0, -50), RoadKind.STREET);
            List<RoadGraph.Chain> chains = g.chains();
            assertEquals(3, chains.size());
            assertEquals(List.of(0, 1, 2), chains.get(0).nodes());
            assertEquals(List.of(0, 1), chains.get(0).edges());
        }

        @Test
        void unChangementDeTypeCoupeLeRuban() {
            RoadGraph g = new RoadGraph();
            RoadNode a = g.addNode(0, 0);
            RoadNode b = g.addNode(50, 0);
            g.addEdge(a, b, RoadKind.STREET);
            g.addEdge(b, g.addNode(100, 0), RoadKind.AVENUE);
            List<RoadGraph.Chain> chains = g.chains();
            assertEquals(2, chains.size());
            assertEquals(RoadKind.STREET, chains.get(0).kind());
            assertEquals(RoadKind.AVENUE, chains.get(1).kind());
            assertEquals(List.of(2, 1), chains.get(1).nodes()); // parcouru depuis l'extrémité de degré 1
        }

        @Test
        void uneBouclePureEstUnSeulRubanFerme() {
            RoadGraph g = new RoadGraph();
            RoadNode a = g.addNode(0, 0);
            RoadNode b = g.addNode(10, 0);
            RoadNode c = g.addNode(0, 10);
            g.addEdge(a, b, RoadKind.HIGHWAY);
            g.addEdge(b, c, RoadKind.HIGHWAY);
            g.addEdge(c, a, RoadKind.HIGHWAY);
            List<RoadGraph.Chain> chains = g.chains();
            assertEquals(1, chains.size());
            assertEquals(List.of(0, 1, 2, 0), chains.get(0).nodes());
        }
    }

    @Test
    void voieEtDirectionSurUnTronconHorsOrigineEtOblique() {
        RoadGraph g = new RoadGraph();
        RoadNode a = g.addNode(100, 200);
        RoadNode b = g.addNode(130, 240);
        RoadEdge e = g.addEdge(a, b, RoadKind.STREET);
        assertEquals(50, e.length(), EPS);
        assertEquals(new Vec2(0.6, 0.8), g.direction(e, 1));
        Vec3 p = g.lanePoint(e, 1, 0, 25);
        double off = 0.5 * WorldConstants.LANE_WIDTH;
        assertEquals(100 + 0.6 * 25 - 0.8 * off, p.x(), EPS);
        assertEquals(200 + 0.8 * 25 + 0.6 * off, p.z(), EPS);
    }

    @Test
    void uneApprocheDiagonaleSuitLeCycleNordSud() {
        RoadGraph g = new RoadGraph();
        RoadNode c = g.addNode(0, 0);
        RoadEdge diag = g.addEdge(c, g.addNode(50, 50), RoadKind.STREET);
        c.light = true;
        assertEquals(LightState.RED, g.lightState(c, diag, 0));
        assertEquals(LightState.GREEN, g.lightState(c, diag, 13));
    }
}
