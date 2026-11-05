package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
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

    @ParameterizedTest(name = "{0} : {1} → [{2}]")
    @CsvSource({
        "'4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1', e2, ''", // L2 : fou cloué devant son roi, il ne bouge pas
        "'k7/8/8/8/8/8/r7/4K3 w - - 0 1', e1, 'd1 f1'", // L2 : le roi ne va pas sur la rangée 2 attaquée
        "'k3r3/8/8/8/8/8/8/1N2K3 w - - 0 1', b1, ''", // L2 : en échec, le cavalier ne peut rien parer
        "'8/8/8/8/8/4k3/8/4K3 w - - 0 1', e1, 'd1 f1'" // L3 : les deux rois ne sont jamais voisins
    })
    void seulsLesCoupsQuiNeLaissentPasSonRoiEnEchecSontLegaux(String fen, String from, String expected) {
        Set<Square> legal = Game.legalDestinations(Fen.parse(fen), Square.of(from));

        assertThat(legal).isEqualTo(squares(expected));
    }

    @Test
    void unCoupQuiLaisseSonRoiEnEchecEstRefuse() {
        // L5 : le fou cloué e2 ne peut pas aller en d3, même si c'est un coup de fou
        Position position = Fen.parse("4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1");

        assertThatThrownBy(() -> Game.play(position, Square.of("e2"), Square.of("d3")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("échec");
    }

    private static Set<Square> squares(String notations) {
        return notations.isBlank()
                ? Set.of()
                : Arrays.stream(notations.split(" ")).map(Square::of).collect(Collectors.toSet());
    }
}
