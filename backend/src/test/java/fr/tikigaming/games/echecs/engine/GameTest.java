package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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

    private static Position play(String fen, String from, String to) {
        return Game.play(Fen.parse(fen), Square.of(from), Square.of(to));
    }
}
