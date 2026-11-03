package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FenTest {

    @Test
    @DisplayName("lit le placement des pièces : roi blanc en e1, roi noir en e8, d4 vide")
    void litLePlacementDesPieces() {
        // Act
        Position position = Fen.parse("4k3/8/8/8/8/8/8/4K3 w - - 0 1");

        // Assert
        assertThat(position.pieceAt(Square.of("e1"))).contains(new Piece(Color.WHITE, PieceType.KING));
        assertThat(position.pieceAt(Square.of("e8"))).contains(new Piece(Color.BLACK, PieceType.KING));
        assertThat(position.pieceAt(Square.of("d4"))).isEmpty();
    }
}
