package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.world.WorldConstants.Ring;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Le bruit est injecté (port {@link Noise2D}) : un stub constant rend le relief analytique, ce qui
 * permet de vérifier chaque règle de forme sans dépendre de l'aléa.
 */
@DisplayName("Terrain : relief, côte et aplanissement des routes")
class TerrainTest {

    /** Stub : bruit nul partout, donc fbm = 0,5. */
    static final Noise2D FLAT_NOISE = (x, y) -> 0;

    static Terrain terrain;

    @BeforeAll
    static void arrange() {
        terrain = new Terrain(FLAT_NOISE);
    }

    @Test
    void laVilleEstPlate() {
        assertEquals(0, terrain.baseHeight(0, 0));
        assertEquals(0, terrain.heightAt(60, 160));
    }

    @Nested
    @DisplayName("collines du nord")
    class Collines {
        @Test
        void commencentJusteApresLePeripherique() {
            // smoothstep(minZ - 15, minZ - 240, z) vaut 0 à z = minZ - 15.
            assertEquals(0, terrain.baseHeight(0, Ring.MIN_Z - 15));
            assertTrue(terrain.baseHeight(0, Ring.MIN_Z - 16) > 0);
        }

        @Test
        void atteignentLeurPleineHauteurAuNord() {
            // t = 1 : 14 + (-z + minZ) * 0,1 + 34 * fbm, avec fbm = 0,5.
            double z = -1000;
            assertEquals(14 + (-z + Ring.MIN_Z) * 0.1 + 17, terrain.baseHeight(0, z), 1e-9);
        }
    }

    @Nested
    @DisplayName("littoral ouest")
    class Littoral {
        @ParameterizedTest(name = "{0} m sous la ligne de rivage -> {1} m")
        @CsvSource({"0, 0", "10, -0.7", "128.57142857142858, -9", "300, -9"})
        void plageEnPenteDouceBorneeA9m(double depth, double expected) {
            double z = 0;
            double x = WorldConstants.shoreX(z) - depth;
            assertEquals(expected, terrain.baseHeight(x, z), 1e-9);
        }

        @Test
        void leQuaiDuPortEstUnMurVertical() {
            assertEquals(-9, terrain.baseHeight(-830.01, 500));
            assertEquals(0, terrain.baseHeight(-829.99, 500));
        }
    }

    @Test
    void collinesDeBordureALEstEtAuSud() {
        assertEquals(0, terrain.baseHeight(500, 500));
        assertTrue(terrain.baseHeight(1020, 0) > 20);
        assertTrue(terrain.baseHeight(0, 1020) > 10);
    }

    @Nested
    @DisplayName("heightAt : échantillonnage de la grille")
    class Echantillonnage {
        @Test
        void auxNoeudsDeGrilleRenvoieLaValeurStockee() {
            int n = WorldConstants.TERRAIN_CELLS;
            int ix = 100;
            int iz = 30;
            double x = -WorldConstants.MAP_HALF + ix * WorldConstants.TERRAIN_RES;
            double z = -WorldConstants.MAP_HALF + iz * WorldConstants.TERRAIN_RES;
            assertEquals(terrain.heights()[ix * (n + 1) + iz], terrain.heightAt(x, z), 1e-6);
        }

        @Test
        void interpoleLineairementEntreDeuxNoeuds() {
            // À z = -1000 (nœud de grille), le relief des collines est linéaire en z.
            double z0 = -1000;
            double a = terrain.heightAt(0, z0);
            double b = terrain.heightAt(0, z0 + 4);
            assertTrue(Math.abs(a - b) > 0.1);
            assertEquals((a + b) / 2, terrain.heightAt(0, z0 + 2), 1e-4);
        }

        @Test
        void horsCarteEstBorneAuBord() {
            assertEquals(terrain.heightAt(1024, 0), terrain.heightAt(5000, 0), 1e-9);
            assertEquals(terrain.heightAt(-1024, -1024), terrain.heightAt(-5000, -5000), 1e-9);
        }

        @Test
        void laGrilleSuitLeFormatDuHeightfieldRapier() {
            assertEquals(513 * 513, terrain.heights().length);
        }
    }

    @Test
    @DisplayName("flattenAlong : la route suit un profil lissé de pente ≤ 14 %")
    void aplanitLeLongDUneRouteDeColline() {
        // Arrange : un terrain dédié (l'aplanissement modifie la grille).
        Terrain t = new Terrain(FLAT_NOISE);
        List<Polyline.Point> pts = new ArrayList<>();
        for (double z = Ring.MIN_Z; z >= -880; z -= 25) pts.add(new Polyline.Point(0, z));
        Polyline line = new Polyline(pts, RoadKind.HILL.width);
        // Act
        double[] prof = t.flattenAlong(line);
        // Assert
        assertEquals(pts.size(), prof.length);
        for (int i = 1; i < prof.length; i++) {
            assertTrue(Math.abs(prof[i] - prof[i - 1]) <= 25 * 0.14 + 1e-9, "pente au point " + i);
        }
        for (int i = 0; i < pts.size(); i++) {
            Polyline.Point p = pts.get(i);
            assertEquals(prof[i], t.heightAt(p.x(), p.z()), 0.5, "hauteur sur la route au point " + i);
        }
    }
}
