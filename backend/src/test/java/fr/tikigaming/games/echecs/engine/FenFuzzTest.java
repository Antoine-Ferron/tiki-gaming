package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Fuzzing de {@link Fen#parse} (cours J3_AM) : on lui envoie des milliers d'entrées générées au hasard et on vérifie
 * seulement qu'il ne « plante » jamais, sans oracle métier. Une FEN invalide doit être refusée par une
 * {@link IllegalArgumentException} (message lisible), jamais par une autre exception (NullPointerException,
 * IndexOutOfBounds…). Une FEN acceptée doit être canonique : sa réécriture redonne exactement l'entrée.
 *
 * <p>La graine est fixe : un échec est donc reproductible, et l'entrée fautive est affichée dans le nom du test.
 */
class FenFuzzTest {

    private static final long SEED = 20261104L;
    private static final int RANDOM_INPUTS = 2000;
    private static final int MUTATED_INPUTS = 3000;

    /** Caractères « du domaine » (FEN) et quelques caractères hostiles (octet nul, Unicode, espaces spéciaux). */
    private static final String ALPHABET = "pnbrqkPNBRQK0123456789/ -wbKQkqaefh\u0000\t\né♚　";

    private static final List<String> VALID_FENS = List.of(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
            "k7/8/8/3n1b2/4P3/8/8/7K w - - 0 1",
            "r3k2r/8/8/8/8/8/8/R3K2R b Kq - 12 40");

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("fuzzedInputs")
    @DisplayName("Fen.parse ne lève jamais autre chose qu'une IllegalArgumentException")
    void fenParseNeLeveQueDesIllegalArgumentException(String input) {
        Position position;
        try {
            position = Fen.parse(input);
        } catch (IllegalArgumentException expected) {
            assertThat(expected.getMessage()).isNotBlank();
            return;
        } catch (RuntimeException unexpected) {
            fail("Exception imprévue " + unexpected.getClass().getSimpleName() + " pour « " + input + " »", unexpected);
            return;
        }
        // Acceptée : la FEN doit être canonique, donc réécrite à l'identique (propriété, sans résultat écrit à la main)
        assertThat(Fen.toFen(position)).isEqualTo(input);
    }

    static Stream<String> fuzzedInputs() {
        Random random = new Random(SEED);
        List<String> inputs = new ArrayList<>(VALID_FENS);
        inputs.addAll(extremeCounters());
        for (int i = 0; i < RANDOM_INPUTS; i++) {
            inputs.add(randomString(random, random.nextInt(80)));
        }
        for (int i = 0; i < MUTATED_INPUTS; i++) {
            inputs.add(mutate(random, VALID_FENS.get(random.nextInt(VALID_FENS.size()))));
        }
        return inputs.stream();
    }

    /** Entiers extrêmes dans les compteurs : dépassement, négatif, vide. */
    private static List<String> extremeCounters() {
        String prefix = "k7/8/8/8/8/8/8/7K w - - ";
        return List.of(
                prefix + "2147483647 1",
                prefix + "2147483648 1",
                prefix + "99999999999999999999 1",
                prefix + "-1 1",
                prefix + "0 -2147483648",
                prefix + "+5 1",
                prefix + "0x10 1",
                prefix + " 1",
                "k7/8/8/8/8/8/8/7K w - -  0 1");
    }

    private static String randomString(Random random, int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return builder.toString();
    }

    /** Une FEN valide altérée de 1 à 4 fois : caractère supprimé, inséré, remplacé ou dupliqué. */
    private static String mutate(Random random, String fen) {
        StringBuilder builder = new StringBuilder(fen);
        int mutations = 1 + random.nextInt(4);
        for (int m = 0; m < mutations && !builder.isEmpty(); m++) {
            int at = random.nextInt(builder.length());
            char randomChar = ALPHABET.charAt(random.nextInt(ALPHABET.length()));
            switch (random.nextInt(4)) {
                case 0 -> builder.deleteCharAt(at);
                case 1 -> builder.insert(at, randomChar);
                case 2 -> builder.setCharAt(at, randomChar);
                default -> builder.insert(at, builder.charAt(at));
            }
        }
        return builder.toString();
    }
}
