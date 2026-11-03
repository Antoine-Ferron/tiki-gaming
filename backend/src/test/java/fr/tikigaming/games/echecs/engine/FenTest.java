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

    @Test
    @DisplayName("lit qui doit jouer : w pour les Blancs, b pour les Noirs")
    void litQuiDoitJouer() {
        // Act + Assert
        assertThat(Fen.parse("4k3/8/8/8/8/8/8/4K3 w - - 0 1").turn()).isEqualTo(Color.WHITE);
        assertThat(Fen.parse("4k3/8/8/8/8/8/8/4K3 b - - 0 1").turn()).isEqualTo(Color.BLACK);
    }

    @Test
    @DisplayName("lit les droits de roque : KQkq, Kq et aucun (-)")
    void litLesDroitsDeRoque() {
        // Act
        CastlingRights tous = Fen.parse(START).castling();
        CastlingRights certains =
                Fen.parse("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1").castling();
        CastlingRights aucun = Fen.parse("4k3/8/8/8/8/8/8/4K3 w - - 0 1").castling();

        // Assert
        assertThat(tous).isEqualTo(new CastlingRights(true, true, true, true));
        assertThat(certains).isEqualTo(new CastlingRights(true, false, false, true));
        assertThat(aucun).isEqualTo(new CastlingRights(false, false, false, false));
    }

    @Test
    @DisplayName("lit la case de prise en passant : aucune (-) ou e3")
    void litLaCaseDePriseEnPassant() {
        // Act
        Position sansPriseEnPassant = Fen.parse(START);
        Position apresE4 = Fen.parse(AFTER_E4);

        // Assert
        assertThat(sansPriseEnPassant.enPassant()).isEmpty();
        assertThat(apresE4.enPassant()).contains(Square.of("e3"));
    }

    private static final String AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}
