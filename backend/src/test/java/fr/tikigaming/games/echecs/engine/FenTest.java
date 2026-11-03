package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

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

    @Test
    @DisplayName("lit le compteur de demi-coups (règle des 50 coups) et le numéro du coup")
    void litLesCompteurs() {
        // Act
        Position depart = Fen.parse(START);
        Position milieuDePartie = Fen.parse("4k3/8/8/8/8/8/8/4K3 w - - 45 30");

        // Assert
        assertThat(depart.halfmoveClock()).isZero();
        assertThat(depart.fullmoveNumber()).isEqualTo(1);
        assertThat(milieuDePartie.halfmoveClock()).isEqualTo(45);
        assertThat(milieuDePartie.fullmoveNumber()).isEqualTo(30);
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(
            strings = {
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
                "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
                "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
                "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"
            })
    @DisplayName("lire puis réécrire une FEN redonne exactement la même FEN (aller-retour)")
    void lirePuisReecrireUneFenRedonneLaMemeFen(String fen) {
        // Act + Assert
        assertThat(Fen.toFen(Fen.parse(fen))).isEqualTo(fen);
    }

    @ParameterizedTest(name = "\"{0}\" est refusée")
    @NullAndEmptySource
    @ValueSource(
            strings = {
                "4k3/8/8/8/8/8/8/4K3 w - - 0", // 5 champs au lieu de 6
                "4k3/8/8/8/8/8/4K3 w - - 0 1", // 7 rangées au lieu de 8
                "4k3/8/8/8/8/8/8/4K4 w - - 0 1", // rangée de 9 cases
                "4k3/8/8/8/8/8/8/4K2 w - - 0 1", // rangée de 7 cases
                "4k3/8/8/8/8/8/8/4KX2 w - - 0 1", // lettre de pièce inconnue
                "4k3/8/8/8/8/8/8/4K3 x - - 0 1", // trait inconnu
                "4k3/8/8/8/8/8/8/4K3 w KX - 0 1", // droit de roque inconnu
                "4k3/8/8/8/8/8/8/4K3 w - e5 0 1", // prise en passant hors rangées 3 et 6
                "4k3/8/8/8/8/8/8/4K3 w - - -1 1", // compteur de demi-coups négatif
                "4k3/8/8/8/8/8/8/4K3 w - - a 1", // compteur non numérique
                "4k3/8/8/8/8/8/8/4K3 w - - 0 0" // numéro de coup à 0
            })
    @DisplayName("une FEN mal écrite est refusée (format)")
    void uneFenMalEcriteEstRefusee(String fen) {
        // Act + Assert
        assertThatThrownBy(() -> Fen.parse(fen)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest(name = "\"{0}\" est refusée")
    @ValueSource(
            strings = {
                "4k3/8/8/8/8/8/8/8 w - - 0 1", // aucun roi blanc
                "8/8/8/8/8/8/8/4K3 w - - 0 1", // aucun roi noir
                "4k3/8/8/8/8/8/8/3KK3 w - - 0 1", // deux rois blancs
                "3kk3/8/8/8/8/8/8/4K3 w - - 0 1", // deux rois noirs
                "4k3/8/8/8/8/8/8/P3K3 w - - 0 1", // pion blanc en rangée 1
                "P3k3/8/8/8/8/8/8/4K3 w - - 0 1", // pion blanc en rangée 8
                "4k3/8/8/8/8/8/8/p3K3 w - - 0 1", // pion noir en rangée 1
                "p3k3/8/8/8/8/8/8/4K3 w - - 0 1" // pion noir en rangée 8
            })
    @DisplayName("une position impossible aux échecs est refusée (un roi par camp, pas de pion en rangée 1 ou 8)")
    void unePositionImpossibleEstRefusee(String fen) {
        // Act + Assert
        assertThatThrownBy(() -> Fen.parse(fen)).isInstanceOf(IllegalArgumentException.class);
    }

    private static final String AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}
