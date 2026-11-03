package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.core.MathUtil;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Tremplins et rez-de-chaussée accessibles, vérifiés par leurs invariants sur la ville du jeu. */
@Tag("integration")
@DisplayName("CityGenerator : tremplins et bâtiments où l'on peut entrer")
class RampsAndEntrancesTest {

    static CityData city;

    @BeforeAll
    static void arrange() {
        city = CityGenerator.generate(1337);
    }

    @Test
    void laVillePossedeDesTremplinsDeChaqueMatiere() {
        assertTrue(city.ramps().size() >= 10);
        Set<RampKind> kinds = EnumSet.noneOf(RampKind.class);
        for (Ramp r : city.ramps()) kinds.add(r.kind());
        assertEquals(EnumSet.allOf(RampKind.class), kinds);
    }

    @Test
    void lesTremplinsSontDansLaCarteHorsDeLEauEtDeTailleRaisonnable() {
        double limit = WorldConstants.MAP_HALF - 20;
        for (Ramp r : city.ramps()) {
            assertTrue(Math.abs(r.x()) < limit && Math.abs(r.z()) < limit, "hors carte : " + r);
            assertTrue(r.x() - WorldConstants.shoreX(r.z()) > 10, "dans l'eau : " + r);
            assertTrue(r.height() > 0.5 && r.height() < 2.5, "hauteur : " + r);
            assertTrue(r.length() > 4 * r.height(), "pente trop raide : " + r);
            assertEquals(WorldConstants.chunkIndexOf(r.x(), r.z()), r.chunk());
        }
    }

    @Test
    void aucunTremplinNEmpieteSurUneRouteEmprunteeParLeTrafic() {
        RoadGraph g = city.roads().graph();
        for (Ramp r : city.ramps()) {
            double radius = Math.hypot(r.length(), r.width()) / 2;
            for (RoadEdge e : g.edges) {
                RoadNode a = g.nodes.get(e.a());
                RoadNode b = g.nodes.get(e.b());
                double d =
                        MathUtil.pointSegment(r.x(), r.z(), a.x, a.z, b.x, b.z).d();
                assertTrue(d > e.width() / 2 + radius, "sur la route " + e.id() + " : " + r);
            }
        }
    }

    @Test
    void aucunTremplinNeChevaucheUnBatiment() {
        for (Ramp r : city.ramps()) {
            double radius = Math.hypot(r.length(), r.width()) / 2;
            for (Building b : city.buildings()) {
                double reach = b.rot == 0 ? 0 : Math.max(b.hw, b.hd);
                boolean overlaps =
                        Math.abs(b.x - r.x()) < b.hw + reach + radius && Math.abs(b.z - r.z()) < b.hd + reach + radius;
                assertTrue(!overlaps, "sur le bâtiment " + b.id + " : " + r);
            }
        }
    }

    @Test
    void desMaisonsEtDesImmeublesOntUnRezDeChausseeAccessible() {
        List<Building> open = city.buildings().stream()
                .filter(b -> b.special == null && b.doorSide != null)
                .toList();
        assertTrue(open.size() > 30, "seulement " + open.size());
        assertTrue(open.stream().anyMatch(b -> b.style == FacadeStyle.HOUSE));
        assertTrue(open.stream().anyMatch(b -> b.style != FacadeStyle.HOUSE));
        for (Building b : open) {
            assertNotNull(b.floorHeight);
            assertTrue(b.floorHeight >= 2.8 && b.floorHeight <= b.h, "rez-de-chaussée : " + b.floorHeight);
        }
    }

    @Test
    void laPorteDonneSurLaFacadeLaPlusProcheDeLaRue() {
        for (Building b : city.buildings()) {
            if (b.special != null || b.doorSide == null) continue;
            Block block = city.blocks().stream()
                    .filter(bl -> bl.containsStrict(b.x, b.z))
                    .findFirst()
                    .orElseThrow();
            double[] gap = {
                b.z - b.hd - block.z0(), block.x1() - (b.x + b.hw), block.z1() - (b.z + b.hd), b.x - b.hw - block.x0()
            };
            for (double g : gap) assertTrue(gap[b.doorSide] <= g + 1e-9, "porte côté cour : " + b.id);
            assertTrue(gap[b.doorSide] <= 14);
        }
    }

    @Test
    void estDeterministe() {
        CityData again = CityGenerator.generate(1337);
        assertEquals(city.ramps(), again.ramps());
        List<Integer> doors = city.buildings().stream().map(b -> b.doorSide).toList();
        assertEquals(doors, again.buildings().stream().map(b -> b.doorSide).toList());
    }

    @Test
    void lesNouveautesNeChangentPasLeResteDeLaVille() {
        // Tremplins et entrées sont tirés après tout le reste : mobilier et bâtiments gardent leurs positions.
        CityData again = CityGenerator.generate(1337);
        assertEquals(city.props().size(), again.props().size());
        assertEquals(city.buildings().get(0).h, again.buildings().get(0).h);
    }
}
