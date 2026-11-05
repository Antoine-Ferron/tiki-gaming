package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Coups spéciaux : promotion (S6), roque (S1-S3), prise en passant (S4-S5). */
class SpecialMovesTest {

    private static String play(String fen, String from, String to, PieceType promotion) {
        return Fen.toFen(Game.play(Fen.parse(fen), Square.of(from), Square.of(to), Optional.ofNullable(promotion)));
    }

    @ParameterizedTest(name = "{1} → {2} en {3}")
    @CsvSource({
        "'k7/4P3/8/8/8/8/8/7K w - - 0 1', e7, e8, QUEEN, 'k3Q3/8/8/8/8/8/8/7K b - - 0 1'", // par avance
        "'k7/4P3/8/8/8/8/8/7K w - - 0 1', e7, e8, KNIGHT, 'k3N3/8/8/8/8/8/8/7K b - - 0 1'", // au choix du joueur
        "'k2r4/4P3/8/8/8/8/8/7K w - - 0 1', e7, d8, ROOK, 'k2R4/8/8/8/8/8/8/7K b - - 0 1'", // par capture
        "'k7/8/8/8/8/8/3p4/7K b - - 0 1', d2, d1, BISHOP, 'k7/8/8/8/8/8/8/3b3K w - - 0 2'" // un pion noir
    })
    void unPionQuiAtteintLaDerniereRangeeEstPromu(String fen, String from, String to, PieceType type, String expected) {
        assertThat(play(fen, from, to, type)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "promotion {0} refusée")
    @CsvSource(
            value = {"NULL", "KING", "PAWN"},
            nullValues = "NULL")
    void laPromotionEstObligatoireEtJamaisEnRoiNiEnPion(PieceType type) {
        assertThatThrownBy(() -> play("k7/4P3/8/8/8/8/8/7K w - - 0 1", "e7", "e8", type))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("romotion");
    }

    @Test
    void uneDemandeDePromotionSansPionEnDerniereRangeeEstRefusee() {
        assertThatThrownBy(() -> play("k7/8/8/8/8/8/4P3/7K w - - 0 1", "e2", "e4", PieceType.QUEEN))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("romotion");
    }
}
