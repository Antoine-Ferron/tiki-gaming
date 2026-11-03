package fr.tikigaming.games.mini_gta.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("Rng : PRNG mulberry32 déterministe")
class RngTest {

    @Test
    void estDeterministePourUneGraine() {
        Rng a = new Rng(42);
        Rng b = new Rng(42);
        for (int i = 0; i < 100; i++) assertEquals(a.next(), b.next());
    }

    @Test
    void differeEntreDeuxGraines() {
        assertNotEquals(new Rng(1).next(), new Rng(2).next());
    }

    @Test
    void accepteLesGrainesNegativesCommeEntiersNonSignes() {
        // La graine est réduite à 32 bits : -1 et 2^32 - 1 désignent le même état.
        assertEquals(new Rng(4294967295L).next(), new Rng(-1).next());
    }

    @Test
    void nextResteDansZeroUnSemiOuvert() {
        Rng rng = new Rng(7);
        for (int i = 0; i < 10_000; i++) {
            double f = rng.next();
            assertTrue(f >= 0 && f < 1, "hors bornes : " + f);
        }
    }

    @ParameterizedTest(name = "int({0}, {1}) reste dans les bornes inclusives")
    @CsvSource({"3, 6", "0, 0", "-5, 5"})
    void intResteDansLesBornesInclusives(int min, int max) {
        Rng rng = new Rng(11);
        for (int i = 0; i < 2_000; i++) {
            int n = rng.nextInt(min, max);
            assertTrue(n >= min && n <= max, "hors bornes : " + n);
        }
    }

    @Test
    void intCouvreToutLIntervalle() {
        Rng rng = new Rng(9);
        Set<Integer> seen = new TreeSet<>();
        for (int i = 0; i < 1000; i++) seen.add(rng.nextInt(0, 3));
        assertEquals(Set.of(0, 1, 2, 3), seen);
    }

    @Test
    void rangeEstDansMinMax() {
        Rng rng = new Rng(3);
        for (int i = 0; i < 1000; i++) {
            double v = rng.range(-2, 5);
            assertTrue(v >= -2 && v < 5);
        }
    }

    @Test
    void pickRetourneUnElementDeLaListe() {
        Rng rng = new Rng(4);
        List<String> items = List.of("a", "b", "c");
        Set<String> seen = new TreeSet<>();
        for (int i = 0; i < 200; i++) seen.add(rng.pick(items));
        assertEquals(Set.of("a", "b", "c"), seen);
    }

    @Test
    void pickRefuseUneListeVide() {
        assertThrows(IllegalArgumentException.class, () -> new Rng(1).pick(List.of()));
    }

    @Test
    @DisplayName("chance(p) : comparaison stricte du tirage à p (valeurs limites)")
    void chanceEstUneComparaisonStricte() {
        double draw = new Rng(42).next();
        assertFalse(new Rng(42).chance(draw), "p == tirage : refus");
        assertTrue(new Rng(42).chance(Math.nextUp(draw)), "p juste au-dessus : accepté");
        assertFalse(new Rng(42).chance(Math.nextDown(draw)), "p juste en dessous : refus");
    }

    @Test
    void chanceZeroJamaisEtChanceUnToujours() {
        Rng rng = new Rng(8);
        for (int i = 0; i < 1000; i++) {
            assertFalse(rng.chance(0));
            assertTrue(rng.chance(1));
        }
    }

    @Test
    @DisplayName("fork donne des sous-flux indépendants et reproductibles")
    void forkDonneDesFluxIndependants() {
        Rng a = new Rng(5).fork("roads");
        Rng b = new Rng(5).fork("roads");
        Rng c = new Rng(5).fork("buildings");
        double va = a.next();
        assertEquals(va, b.next());
        assertNotEquals(va, c.next());
    }

    @Test
    void hashStringSuitLesVecteursDeTestFnv1a() {
        // Vecteurs officiels FNV-1a 32 bits.
        assertEquals(0x811c9dc5L, Rng.hashString(""));
        assertEquals(0xe40c292cL, Rng.hashString("a"));
        assertEquals(0xbf9cf968L, Rng.hashString("foobar"));
        assertNotEquals(Rng.hashString("a"), Rng.hashString("b"));
    }

    @Test
    @DisplayName("next est uniforme : 10 classes de même effectif (khi² à 9 degrés de liberté)")
    void nextEstUniforme() {
        Rng rng = new Rng(2024);
        int n = 100_000;
        int[] buckets = new int[10];
        double sum = 0;
        for (int i = 0; i < n; i++) {
            double v = rng.next();
            buckets[(int) (v * 10)]++;
            sum += v;
        }
        double expected = n / 10.0;
        double chi2 = 0;
        for (int b : buckets) chi2 += (b - expected) * (b - expected) / expected;
        assertTrue(chi2 < 27.88, "khi² = " + chi2); // seuil à 0,1 %
        assertEquals(0.5, sum / n, 0.01);
    }

    @Test
    void deuxTiragesSuccessifsSontDecorreles() {
        Rng rng = new Rng(77);
        int n = 50_000;
        double sxy = 0;
        double prev = rng.next();
        for (int i = 0; i < n; i++) {
            double cur = rng.next();
            sxy += (prev - 0.5) * (cur - 0.5);
            prev = cur;
        }
        assertEquals(0, sxy / n / (1.0 / 12), 0.03); // corrélation proche de 0
    }

    @Test
    void deuxForksDeMemeEtiquetteDepuisLeMemeParentDifferent() {
        Rng parent = new Rng(5);
        assertNotEquals(parent.fork("a").next(), parent.fork("a").next());
    }
}
