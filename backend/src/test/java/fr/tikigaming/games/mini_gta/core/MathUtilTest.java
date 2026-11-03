package fr.tikigaming.games.mini_gta.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("MathUtil : fonctions numériques pures")
class MathUtilTest {

    private static final double EPS = 1e-9;

    @Nested
    @DisplayName("clamp : valeurs limites autour de [min, max]")
    class Clamp {
        @ParameterizedTest(name = "clamp({0}, 0, 10) = {1}")
        @CsvSource({
            "-1, 0", // min - 1 : sous la borne
            "0, 0", // min
            "1, 1", // min + 1
            "9, 9", // max - 1
            "10, 10", // max
            "11, 10", // max + 1 : au-dessus de la borne
        })
        void bornesInclusives(double v, double expected) {
            assertEquals(expected, MathUtil.clamp(v, 0, 10), EPS);
        }
    }

    @Test
    void lerpInterpoleLineairement() {
        // Arrange / Act / Assert sur les trois points remarquables
        assertEquals(2, MathUtil.lerp(2, 6, 0), EPS);
        assertEquals(4, MathUtil.lerp(2, 6, 0.5), EPS);
        assertEquals(6, MathUtil.lerp(2, 6, 1), EPS);
    }

    @ParameterizedTest(name = "invLerp(10, 20, {0}) = {1}")
    @CsvSource({"5, 0", "10, 0", "15, 0.5", "20, 1", "25, 1"})
    void invLerpEstBorneDansZeroUn(double v, double expected) {
        assertEquals(expected, MathUtil.invLerp(10, 20, v), EPS);
    }

    @ParameterizedTest(name = "smoothstep(0, 1, {0}) = {1}")
    @CsvSource({"-0.5, 0", "0, 0", "0.5, 0.5", "1, 1", "1.5, 1", "0.25, 0.15625"})
    void smoothstepSuitLaCourbeHermite(double v, double expected) {
        assertEquals(expected, MathUtil.smoothstep(0, 1, v), EPS);
    }

    @Test
    void dampConvergeSansDepasserLaCible() {
        double v = MathUtil.damp(0, 10, 5, 0.1);
        assertTrue(v > 0 && v < 10);
        assertEquals(10 * (1 - Math.exp(-0.5)), v, EPS);
        assertEquals(0, MathUtil.damp(0, 10, 5, 0), EPS);
    }

    @ParameterizedTest(name = "wrapAngle({0}) = {1}")
    @CsvSource({
        "0, 0",
        "3.141592653589793, -3.141592653589793", // +π est ramené à -π (intervalle semi-ouvert)
        "-3.141592653589793, -3.141592653589793",
        "6.283185307179586, 0",
        "-6.283185307179586, 0",
        "4.71238898038469, -1.5707963267948966",
        "-4.71238898038469, 1.5707963267948966",
    })
    void wrapAngleRameneDansMoinsPiPlusPi(double a, double expected) {
        assertEquals(expected, MathUtil.wrapAngle(a), 1e-12);
    }

    @Test
    void dampAnglePrendLeCheminLePlusCourt() {
        // De 170° vers -170° : on passe par 180°, pas par 0°.
        double a = Math.toRadians(170);
        double b = Math.toRadians(-170);
        double r = MathUtil.dampAngle(a, b, 1000, 1);
        assertEquals(a + Math.toRadians(20), r, 1e-9);
    }

    @Test
    void dist2EstLaDistanceEuclidienneDansLePlanXZ() {
        assertEquals(5, MathUtil.dist2(0, 0, 3, 4), EPS);
    }

    @Nested
    @DisplayName("pointSegment : partitions de la projection")
    class PointSegment {
        @Test
        void projectionAvantLeSegmentEstBorneeAZero() {
            MathUtil.SegmentHit h = MathUtil.pointSegment(-5, 0, 0, 0, 10, 0);
            assertEquals(0, h.t(), EPS);
            assertEquals(5, h.d(), EPS);
        }

        @Test
        void projectionSurLeSegment() {
            MathUtil.SegmentHit h = MathUtil.pointSegment(4, 3, 0, 0, 10, 0);
            assertEquals(0.4, h.t(), EPS);
            assertEquals(3, h.d(), EPS);
        }

        @Test
        void projectionApresLeSegmentEstBorneeAUn() {
            MathUtil.SegmentHit h = MathUtil.pointSegment(13, 4, 0, 0, 10, 0);
            assertEquals(1, h.t(), EPS);
            assertEquals(5, h.d(), EPS);
        }

        @Test
        void segmentDegenereSeComporteCommeUnPoint() {
            MathUtil.SegmentHit h = MathUtil.pointSegment(3, 4, 0, 0, 0, 0);
            assertEquals(0, h.t(), EPS);
            assertEquals(5, h.d(), EPS);
        }
    }

    @Test
    void dist2HorsOrigine() {
        assertEquals(5, MathUtil.dist2(10, 20, 13, 24), EPS);
    }

    @Test
    void pointSegmentHorsOrigine() {
        MathUtil.SegmentHit h = MathUtil.pointSegment(14, 23, 10, 20, 20, 20);
        assertEquals(0.4, h.t(), EPS);
        assertEquals(3, h.d(), EPS);
    }

    @Test
    void dampAngleAmortiPartiellement() {
        double r = MathUtil.dampAngle(1, 2, 2, 0.5);
        assertEquals(1 + (1 - Math.exp(-1)), r, EPS);
    }
}
