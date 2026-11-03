package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.core.MathUtil;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * Intégration de tous les générateurs (routes, terrain, îlots, bâtiments, props, trottoirs).
 * La ville est vérifiée par ses invariants (connexité, absence de chevauchement, lieux accessibles),
 * pas par des valeurs figées : le test reste valable si l'algorithme de génération évolue.
 */
@Tag("integration")
@DisplayName("CityGenerator : génération complète de la ville")
class CityGenerationTest {

    static CityData city;

    @BeforeAll
    static void arrange() {
        city = CityGenerator.generate(1337);
    }

    @Test
    void produitUneVilleDeTailleRaisonnable() {
        assertTrue(city.buildings().size() > 400);
        assertTrue(city.blocks().size() > 80);
        assertTrue(city.props().size() > 1000);
        assertTrue(city.parking().size() > 100);
        assertTrue(city.containers().size() > 50);
        assertTrue(city.sidewalk().size() > 100);
    }

    @Test
    void uneAutreGraineDonneUneAutreVille() {
        CityData other = CityGenerator.generate(42);
        List<Double> a = city.buildings().stream().map(b -> b.h).toList();
        List<Double> b = other.buildings().stream().map(o -> o.h).toList();
        assertNotEquals(a, b);
    }

    @Test
    void lePointDeDepartEstDevantLaPlanque() {
        Locations l = city.locations();
        assertEquals(l.safehouseDoor(), l.spawn());
        Building safe = city.buildings().stream()
                .filter(b -> b.special == SpecialKind.SAFEHOUSE)
                .findFirst()
                .orElseThrow();
        assertTrue(Math.hypot(l.spawn().x() - safe.x, l.spawn().z() - safe.z) < Math.max(safe.hw, safe.hd) + 3);
        assertTrue(Math.hypot(
                        l.garage().x() - l.spawn().x(),
                        l.garage().z() - l.spawn().z())
                < 60);
    }

    @Test
    void lesBatimentsSpeciauxEntrablesOntLaTailleDemandee() {
        for (Building b : city.buildings()) {
            if (b.special == SpecialKind.SAFEHOUSE) assertEquals(List.of(7.0, 6.0, 4.2), List.of(b.hw, b.hd, b.h));
            if (b.special == SpecialKind.WAREHOUSE) assertEquals(List.of(16.0, 12.0, 9.0), List.of(b.hw, b.hd, b.h));
        }
    }

    @Test
    void estDeterministe() {
        CityData again = CityGenerator.generate(1337);
        assertEquals(city.buildings().size(), again.buildings().size());
        assertEquals(city.buildings().get(10).x, again.buildings().get(10).x);
        assertArrayEquals(city.terrain().heights(), again.terrain().heights());
    }

    @Test
    void leReseauRoutierEstConnexe() {
        RoadGraph g = city.roads().graph();
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
    void leReseauDeTrottoirsEstConnexe() {
        List<SidewalkNode> sw = city.sidewalk();
        Set<Integer> seen = new HashSet<>(List.of(0));
        Deque<Integer> stack = new ArrayDeque<>(List.of(0));
        while (!stack.isEmpty()) {
            for (int l : sw.get(stack.pop()).links) {
                if (seen.add(l)) stack.push(l);
            }
        }
        assertEquals(sw.size(), seen.size());
    }

    @Test
    void aucunBatimentNEstPoseSurUneRoute() {
        RoadGraph g = city.roads().graph();
        for (Building b : city.buildings()) {
            double radius = Math.min(b.hw, b.hd);
            for (RoadEdge e : g.edges) {
                RoadNode a = g.nodes.get(e.a());
                RoadNode c = g.nodes.get(e.b());
                double d = MathUtil.pointSegment(b.x, b.z, a.x, a.z, c.x, c.z).d();
                assertTrue(d > e.width() / 2 + radius * 0.9, "bâtiment " + b.id + " sur le tronçon " + e.id());
            }
        }
    }

    @Test
    void lesBatimentsOntDesDimensionsFiniesEtPositives() {
        for (Building b : city.buildings()) {
            for (double v : new double[] {b.x, b.z, b.hw, b.hd, b.h, b.y0}) assertTrue(Double.isFinite(v));
            assertTrue(b.h > 2 && b.hw > 1 && b.hd > 1, "bâtiment " + b.id);
        }
    }

    @Test
    void chaqueBatimentSpecialEstPlaceUneFois() {
        List<SpecialKind> kinds = city.buildings().stream()
                .map(b -> b.special)
                .filter(Objects::nonNull)
                .toList();
        assertEquals(5, kinds.size());
        assertEquals(EnumSet.allOf(SpecialKind.class), EnumSet.copyOf(kinds));
        for (Building b : city.buildings()) {
            boolean enterable = b.special == SpecialKind.SAFEHOUSE
                    || b.special == SpecialKind.GUNSHOP
                    || b.special == SpecialKind.WAREHOUSE;
            assertEquals(enterable, b.doorSide != null, "bâtiment " + b.id);
        }
    }

    @Test
    void lesLieuxClesSontDansLaCarte() {
        for (Location loc : city.locations().all()) {
            assertTrue(Math.abs(loc.x()) < WorldConstants.MAP_HALF);
            assertTrue(Math.abs(loc.z()) < WorldConstants.MAP_HALF);
        }
    }

    @Test
    void laVilleEstPlateEtLesCollinesHautes() {
        assertTrue(Math.abs(city.terrain().heightAt(0, 0)) < 0.01);
        assertTrue(city.terrain().heightAt(0, -1000) > 20);
        assertTrue(city.terrain().heightAt(-1000, 0) < -1);
    }

    @Test
    void lesPointsDeReapparitionSontSurLeTrottoir() {
        for (Location loc :
                List.of(city.locations().hospital(), city.locations().policeStation())) {
            Block block = city.blocks().stream()
                    .filter(b -> b.containsInclusive(loc.x(), loc.z()))
                    .findFirst()
                    .orElseThrow();
            double edge = Math.min(
                    Math.min(loc.x() - block.x0(), block.x1() - loc.x()),
                    Math.min(loc.z() - block.z0(), block.z1() - loc.z()));
            assertTrue(edge <= WorldConstants.SIDEWALK_WIDTH);
        }
    }

    @Test
    void lesFeuxTricoloresReferencentLeurCarrefour() {
        List<Prop> lights = city.props().stream()
                .filter(p -> p.kind == PropKind.TRAFFIC_LIGHT)
                .toList();
        assertTrue(lights.size() > 100);
        for (Prop p : lights) {
            assertNotNull(p.node);
            assertTrue(city.roads().graph().nodes.get(p.node).light);
            assertTrue(city.roads().graph().nodes.get(p.node).edges.contains(p.edge));
        }
    }

    @Test
    void lesNoeudsRoutiersSontPosesSurLeTerrain() {
        for (RoadNode n : city.roads().graph().nodes) {
            assertEquals(city.terrain().heightAt(n.x, n.z), n.y, 1e-9);
        }
    }
}
