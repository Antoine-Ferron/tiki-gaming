package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Échec et coups légaux (règles L1 à L5 de la spécification). */
class CheckTest {

    @ParameterizedTest(name = "{0} : roi blanc en échec = {1}")
    @CsvSource({
        "'k3r3/8/8/8/8/8/8/4K3 w - - 0 1', true", // tour noire sur la colonne e
        "'k7/8/8/8/8/8/8/4K3 w - - 0 1', false", // rien n'attaque e1
        "'k7/8/8/8/8/8/3p4/4K3 w - - 0 1', true", // un pion attaque en diagonale
        "'k7/8/8/8/8/8/4p3/4K3 w - - 0 1', false", // un pion devant le roi ne l'attaque pas
        "'k3r3/8/8/8/8/8/4P3/4K3 w - - 0 1', false" // la tour est masquée par un pion
    })
    void leRoiEstEnEchecQuandUnePieceAdverseLAttaque(String fen, boolean inCheck) {
        assertThat(Game.isInCheck(Fen.parse(fen), Color.WHITE)).isEqualTo(inCheck);
    }
}
