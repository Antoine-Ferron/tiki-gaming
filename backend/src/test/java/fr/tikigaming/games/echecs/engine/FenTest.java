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

    @Test
    @DisplayName("la position de départ place rois, dames, tours et pions (règle E4)")
    void laPositionDeDepartPlaceLesPieces() {
        // Act
        Position position = Fen.parse(START);

        // Assert
        assertThat(position.pieceAt(Square.of("e1"))).contains(new Piece(Color.WHITE, PieceType.KING));
        assertThat(position.pieceAt(Square.of("e8"))).contains(new Piece(Color.BLACK, PieceType.KING));
        assertThat(position.pieceAt(Square.of("d1"))).contains(new Piece(Color.WHITE, PieceType.QUEEN));
        assertThat(position.pieceAt(Square.of("d8"))).contains(new Piece(Color.BLACK, PieceType.QUEEN));
        assertThat(position.pieceAt(Square.of("a1"))).contains(new Piece(Color.WHITE, PieceType.ROOK));
        for (int file = 0; file < 8; file++) {
            assertThat(position.pieceAt(new Square(file, 1))).contains(new Piece(Color.WHITE, PieceType.PAWN));
            assertThat(position.pieceAt(new Square(file, 6))).contains(new Piece(Color.BLACK, PieceType.PAWN));
            for (int rank = 2; rank <= 5; rank++) {
                assertThat(position.pieceAt(new Square(file, rank))).isEmpty();
            }
        }
    }

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}
