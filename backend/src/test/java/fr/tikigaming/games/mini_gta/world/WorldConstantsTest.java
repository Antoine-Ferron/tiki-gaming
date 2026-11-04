package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("WorldConstants : découpage géographique de la carte")
class WorldConstantsTest {

    @Test
    void dimensionsDerivees() {
        assertEquals(2048, WorldConstants.MAP_SIZE);
        assertEquals(512, WorldConstants.TERRAIN_CELLS);
        assertEquals(8, WorldConstants.CHUNKS_PER_SIDE);
    }

    @Nested
    @DisplayName("districtAt : partitions d'équivalence et frontières")
    class DistrictAt {

        @ParameterizedTest(name = "({0}, {1}) -> {2}")
        @CsvSource({
            // Une valeur représentative par classe d'équivalence.
            "0, -900, HILLS",
            "900, 0, AIRFIELD",
            "-600, 500, PORT",
            "60, 160, DOWNTOWN",
            "60, 600, COMMERCIAL",
            "-650, -500, SUBURB",
        })
        void unRepresentantParDistrict(double x, double z, District expected) {
            assertEquals(expected, WorldConstants.districtAt(x, z));
        }

        @ParameterizedTest(name = "z = {0} -> {1}")
        @CsvSource({
            // Frontière des collines : z < RING.minZ - 10 = -570 (stricte).
            "-570.001, HILLS",
            "-570, SUBURB",
            "-569.999, SUBURB",
        })
        void frontiereDesCollines(double z, District expected) {
            assertEquals(expected, WorldConstants.districtAt(-650, z));
        }

        @ParameterizedTest(name = "x = {0} -> {1}")
        @CsvSource({
            // Frontière de l'aérodrome : x > RING.maxX + 10 = 770 (stricte).
            "769.999, SUBURB",
            "770, SUBURB",
            "770.001, AIRFIELD",
        })
        void frontiereDeLAerodrome(double x, District expected) {
            assertEquals(expected, WorldConstants.districtAt(x, -400));
        }

        @ParameterizedTest(name = "({0}, {1}) -> {2}")
        @CsvSource({
            // Port : x < -420 ET z > 200 (table de décision à deux conditions).
            "-420.001, 200.001, PORT",
            "-420, 200.001, COMMERCIAL",
            "-420.001, 200, COMMERCIAL",
            "-420, 200, COMMERCIAL",
        })
        void tableDeDecisionDuPort(double x, double z, District expected) {
            // Hors port, (-420, 200) est à ~481 m du centre-ville : zone commerciale.
            assertEquals(expected, WorldConstants.districtAt(x, z));
        }

        @ParameterizedTest(name = "distance {0} m du centre -> {1}")
        @CsvSource({
            "329.999, DOWNTOWN",
            "330, COMMERCIAL",
            "330.001, COMMERCIAL",
            "619.999, COMMERCIAL",
            "620, SUBURB",
        })
        void anneauxConcentriquesDuCentre(double d, District expected) {
            // Plein est depuis le centre-ville (60, 160) : aucune autre règle ne s'applique.
            assertEquals(expected, WorldConstants.districtAt(60 + d, 160));
        }
    }

    @Nested
    class Cote {
        @ParameterizedTest(name = "z = {0} -> quai : {1}")
        @CsvSource({"260, false", "260.001, true", "500, true", "759.999, true", "760, false"})
        void quaiDuPortBornesStrictes(double z, boolean expected) {
            assertEquals(expected, WorldConstants.isPortQuay(z));
        }

        @Test
        void leQuaiEstRectiligne() {
            assertEquals(-830, WorldConstants.shoreX(500));
        }

        @Test
        void horsDuQuaiLaCoteOndule() {
            double expected = -830 + 16 * Math.sin(0) + 9 * Math.sin(1);
            assertEquals(expected, WorldConstants.shoreX(0), 1e-12);
            assertTrue(Math.abs(WorldConstants.shoreX(-300) + 830) <= 25);
        }
    }

    @Nested
    class Chunks {
        @ParameterizedTest(name = "({0}, {1}) -> chunk {2}")
        @CsvSource({
            "-1024, -1024, 0",
            "-768.001, -1024, 0",
            "-768, -1024, 1",
            "0, 0, 36",
            "1023.999, 1023.999, 63",
            "1024, 1024, 63", // bord exact : borné au dernier chunk
            "5000, -5000, 7", // hors carte : borné
            "-5000, 5000, 56",
        })
        void indexBorneALaCarte(double x, double z, int expected) {
            assertEquals(expected, WorldConstants.chunkIndexOf(x, z));
        }

        @Test
        void centreDeChunk() {
            assertEquals(new WorldConstants.XZ(-896, -896), WorldConstants.chunkCenter(0));
            assertEquals(new WorldConstants.XZ(-640, -640), WorldConstants.chunkCenter(9));
        }

        @Test
        void leCentreDUnChunkRetombeDansCeChunk() {
            for (int i = 0; i < 64; i++) {
                WorldConstants.XZ c = WorldConstants.chunkCenter(i);
                assertEquals(i, WorldConstants.chunkIndexOf(c.x(), c.z()));
            }
        }
    }

    @Test
    void specificationsDesRoutes() {
        assertEquals(1, RoadKind.STREET.lanes);
        assertEquals(19, RoadKind.AVENUE.width);
        assertEquals(24, RoadKind.HIGHWAY.speed);
        assertEquals(9, RoadKind.HILL.width);
        assertFalse(RoadKind.HILL.lanes > 1);
    }
}
