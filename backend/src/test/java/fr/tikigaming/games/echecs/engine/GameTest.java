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

    private static Position play(String fen, String from, String to) {
        return Game.play(Fen.parse(fen), Square.of(from), Square.of(to));
    }
}
