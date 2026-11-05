package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Fins de partie (règles F1 à F8 de la spécification). */
class GameStatusTest {

    @ParameterizedTest(name = "{2}")
    @CsvSource({
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ONGOING, départ : partie en cours",
        "'k3r3/8/8/8/8/8/8/4K3 w - - 0 1', CHECK, roi blanc en échec mais il peut fuir",
        "'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', CHECKMATE, F1 : mat du lion (Blancs mats)",
        "'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', STALEMATE, F2 : pat (Noirs sans coup légal ni échec)",
        "'k7/8/8/8/8/8/8/7K w - - 0 1', DRAW_INSUFFICIENT_MATERIAL, F3 : roi contre roi",
        "'k7/8/8/8/8/8/8/5B1K w - - 0 1', DRAW_INSUFFICIENT_MATERIAL, F3 : roi et fou contre roi",
        "'k7/8/8/8/8/8/8/5N1K w - - 0 1', DRAW_INSUFFICIENT_MATERIAL, F3 : roi et cavalier contre roi",
        "'k7/8/8/8/8/8/8/5R1K w - - 0 1', ONGOING, roi et tour contre roi : le mat reste possible",
        "'k7/8/8/8/8/8/8/R6K w - - 100 80', DRAW_FIFTY_MOVES, F5 : 100 demi-coups sans prise ni pion"
    })
    void leStatutDeLaPartieSuitLesRegles(String fen, GameStatus expected, String why) {
        assertThat(Game.status(Fen.parse(fen))).isEqualTo(expected);
    }

    @Test
    void unePartieTermineeNAccepteplusAucunCoup() {
        // F8 : nulle des 50 coups, la tour pourrait pourtant bouger
        Position position = Fen.parse("k7/8/8/8/8/8/8/R6K w - - 100 80");

        assertThatThrownBy(() -> Game.play(position, Square.of("a1"), Square.of("a2")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("terminée");
    }
}
