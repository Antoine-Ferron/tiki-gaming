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

    @ParameterizedTest(name = "{1} → {2}")
    @CsvSource({
        "'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', e1, g1, 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1'", // petit roque blanc
        "'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', e1, c1, 'r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1'", // grand roque blanc
        "'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', e8, g8, 'r4rk1/8/8/8/8/8/8/R3K2R w KQ - 1 2'", // petit roque noir
        "'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', e8, c8, '2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2'" // grand roque noir
    })
    void leRoqueDeplaceLeRoiDeDeuxCasesEtLaTourASesCotes(String fen, String from, String to, String expected) {
        assertThat(play(fen, from, to, null)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "{2}")
    @CsvSource({
        "'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1', '', plus de droit de roque (S3)",
        "'r3k2r/8/8/8/8/8/8/RN2KB1R w KQkq - 0 1', '', une pièce entre le roi et la tour",
        "'r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1', '', le roi est en échec",
        "'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1', c1, le roi traverserait f1 attaquée : seul le grand roque",
        "'r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1', c1, le roi arriverait en g1 attaquée : seul le grand roque",
        "'r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1', 'c1 g1', la tour (et b1) peuvent être attaquées : les deux roques"
    })
    void leRoqueNEstPermisQueSiLesSixConditionsSontReunies(String fen, String castlings, String why) {
        var king = Game.legalDestinations(Fen.parse(fen), Square.of("e1"));
        assertThat(king.contains(Square.of("g1"))).as("petit roque").isEqualTo(castlings.contains("g1"));
        assertThat(king.contains(Square.of("c1"))).as("grand roque").isEqualTo(castlings.contains("c1"));
    }

    @Test
    void laPriseEnPassantEnleveLePionQuiVientDAvancerDeDeuxCases() {
        // S4 : le pion noir vient de jouer d7-d5 (case d6 notée dans la FEN)
        assertThat(play("k7/8/8/3pP3/8/8/8/7K w - d6 0 2", "e5", "d6", null))
                .isEqualTo("k7/8/3P4/8/8/8/8/7K b - - 0 2");
    }

    @ParameterizedTest(name = "{2}")
    @CsvSource({
        "'k7/8/8/3pP3/8/8/8/7K w - - 0 2', e6, S4 : plus de case de prise en passant (pas au coup suivant immédiat)",
        "'8/8/8/K2pP2r/8/8/8/7k w - d6 0 2', e6, S5 : les deux pions quitteraient la rangée et découvriraient le roi"
    })
    void laPriseEnPassantNEstPasToujoursPermise(String fen, String expected, String why) {
        assertThat(Game.legalDestinations(Fen.parse(fen), Square.of("e5"))).containsExactly(Square.of(expected));
    }
}
