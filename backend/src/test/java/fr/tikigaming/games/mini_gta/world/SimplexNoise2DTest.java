package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.core.Rng;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("SimplexNoise2D : bruit de gradient 2D")
class SimplexNoise2DTest {

    @Test
    void estDeterministePourUneMemeSourceDAlea() {
        SimplexNoise2D a = new SimplexNoise2D(new Rng(7)::next);
        SimplexNoise2D b = new SimplexNoise2D(new Rng(7)::next);
        for (double x = -20; x < 20; x += 1.3) assertEquals(a.noise(x, x * 0.7), b.noise(x, x * 0.7));
    }

    @Test
    void laTableDePermutationEstUnePermutationDupliquee() {
        int[] p = SimplexNoise2D.buildPermutationTable(new Rng(7)::next);
        assertEquals(512, p.length);
        boolean[] seen = new boolean[256];
        for (int i = 0; i < 256; i++) {
            seen[p[i]] = true;
            assertEquals(p[i], p[i + 256]);
        }
        for (boolean s : seen) assertTrue(s);
    }

    @Test
    void resteDansMoinsUnPlusUn() {
        Rng rng = new Rng(3);
        SimplexNoise2D noise = new SimplexNoise2D(rng::next);
        for (double x = -50; x < 50; x += 0.37) {
            for (double y = -50; y < 50; y += 0.41) {
                double v = noise.noise(x, y);
                assertTrue(v >= -1 && v <= 1, "hors bornes : " + v);
            }
        }
    }

    @Test
    void estNulAuxSommetsDuReseau() {
        SimplexNoise2D noise = new SimplexNoise2D(new Rng(1)::next);
        assertEquals(0, noise.noise(0, 0), 1e-12);
    }

    @Test
    void estContinu() {
        SimplexNoise2D noise = new SimplexNoise2D(new Rng(5)::next);
        double a = noise.noise(10.0, 10.0);
        double b = noise.noise(10.0 + 1e-6, 10.0);
        assertEquals(a, b, 1e-4);
    }

    @Test
    void dependDeLaGraine() {
        double a = new SimplexNoise2D(new Rng(1)::next).noise(3.3, 4.4);
        double b = new SimplexNoise2D(new Rng(2)::next).noise(3.3, 4.4);
        assertNotEquals(a, b);
    }
}
