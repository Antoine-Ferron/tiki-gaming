package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class GameTest {

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    @Test
    @DisplayName("jouer un coup déplace la pièce : la case de départ se vide, la case d'arrivée reçoit la pièce")
    void jouerUnCoupDeplaceLaPiece() {
        // Act
        Position after = play(START, "e2", "e4");

        // Assert
        assertThat(after.pieceAt(Square.of("e2"))).isEmpty();
        assertThat(after.pieceAt(Square.of("e4"))).isEqualTo(Optional.of(new Piece(Color.WHITE, PieceType.PAWN)));
    }

    @Test
    @DisplayName("après un coup, c'est à l'autre camp de jouer")
    void apresUnCoupCEstALAutreCampDeJouer() {
        // Act
        Position afterWhite = play(START, "e2", "e4");
        Position afterBlack = Game.play(afterWhite, Square.of("e7"), Square.of("e5"));

        // Assert
        assertThat(afterWhite.turn()).isEqualTo(Color.BLACK);
        assertThat(afterBlack.turn()).isEqualTo(Color.WHITE);
    }

    @Test
    @DisplayName("une prise remplace la pièce adverse par la pièce jouée")
    void unePriseRemplaceLaPieceAdverse() {
        // Arrange : pion blanc en e4, cavalier noir en d5
        Position after = play("k7/8/8/3n4/4P3/8/8/7K w - - 0 1", "e4", "d5");

        // Assert : un seul occupant en d5, le pion blanc ; le cavalier a disparu
        assertThat(after.pieceAt(Square.of("d5"))).isEqualTo(Optional.of(new Piece(Color.WHITE, PieceType.PAWN)));
        assertThat(after.pieces()).hasSize(3);
    }

    @Test
    @DisplayName("on ne peut pas jouer une pièce de l'autre camp : c'est aux Blancs de commencer")
    void onNePeutPasJouerUnePieceDeLAutreCamp() {
        // Act + Assert : les Noirs essaient de jouer alors que le trait est aux Blancs
        assertThatThrownBy(() -> play(START, "e7", "e5"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("trait");
    }

    @ParameterizedTest(name = "{0} → {1} est refusé")
    @CsvSource({"e2, e5", "b1, b3", "e1, e2", "a1, a3"})
    @DisplayName("un coup vers une case que la pièce ne peut pas atteindre est refusé")
    void unCoupVersUneCaseInaccessibleEstRefuse(String from, String to) {
        // Act + Assert : trop loin pour le pion, mauvais saut pour le cavalier, case amie, tour bloquée
        assertThatThrownBy(() -> play(START, from, to))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inaccessible");
    }

    @Test
    @DisplayName("jouer depuis une case vide est refusé proprement")
    void jouerDepuisUneCaseVideEstRefuse() {
        // Act + Assert : e4 est vide dans la position de départ
        assertThatThrownBy(() -> play(START, "e4", "e5"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("vide");
    }

    @ParameterizedTest(name = "{0} : {1} → {2} donne demi-coups {3}, coup n°{4}")
    @CsvSource({
        "'k7/8/8/8/8/8/8/R6K w - - 5 10', a1, a2, 6, 10", // coup blanc ordinaire : +1 demi-coup, même numéro
        "'k7/8/8/8/8/8/8/R6K b - - 5 10', a8, b8, 6, 11", // coup noir : le numéro du coup avance
        "'k7/8/8/8/8/8/4P3/7K w - - 5 10', e2, e3, 0, 10", // coup de pion : compteur des 50 coups remis à 0
        "'k7/8/8/8/8/8/8/Rn5K w - - 5 10', a1, b1, 0, 10" // prise : compteur des 50 coups remis à 0
    })
    @DisplayName("les compteurs avancent : demi-coups (règle des 50 coups) et numéro du coup")
    void lesCompteursAvancent(String fen, String from, String to, int halfmoves, int fullmove) {
        // Act
        Position after = play(fen, from, to);

        // Assert
        assertThat(after.halfmoveClock()).isEqualTo(halfmoves);
        assertThat(after.fullmoveNumber()).isEqualTo(fullmove);
    }

    private static Position play(String fen, String from, String to) {
        return Game.play(Fen.parse(fen), Square.of(from), Square.of(to));
    }
}
