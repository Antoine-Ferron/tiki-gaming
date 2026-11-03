package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class PieceTest {

    @Test
    @DisplayName("la lettre N est un cavalier blanc et la lettre n un cavalier noir")
    void laLettreNEstUnCavalierBlancEtLaLettreMinusculeUnCavalierNoir() {
        // Act
        Piece blanc = Piece.fromFen('N');
        Piece noir = Piece.fromFen('n');

        // Assert
        assertThat(blanc).isEqualTo(new Piece(Color.WHITE, PieceType.KNIGHT));
        assertThat(noir).isEqualTo(new Piece(Color.BLACK, PieceType.KNIGHT));
    }

    static Stream<Arguments> lettresFen() {
        return Stream.of(
                Arguments.of('P', Color.WHITE, PieceType.PAWN),
                Arguments.of('N', Color.WHITE, PieceType.KNIGHT),
                Arguments.of('B', Color.WHITE, PieceType.BISHOP),
                Arguments.of('R', Color.WHITE, PieceType.ROOK),
                Arguments.of('Q', Color.WHITE, PieceType.QUEEN),
                Arguments.of('K', Color.WHITE, PieceType.KING),
                Arguments.of('p', Color.BLACK, PieceType.PAWN),
                Arguments.of('n', Color.BLACK, PieceType.KNIGHT),
                Arguments.of('b', Color.BLACK, PieceType.BISHOP),
                Arguments.of('r', Color.BLACK, PieceType.ROOK),
                Arguments.of('q', Color.BLACK, PieceType.QUEEN),
                Arguments.of('k', Color.BLACK, PieceType.KING));
    }

    @ParameterizedTest(name = "{0} → {2} {1}")
    @MethodSource("lettresFen")
    @DisplayName("chacune des 12 lettres FEN donne la bonne pièce")
    void chaqueLettreFenDonneLaBonnePiece(char lettre, Color couleur, PieceType type) {
        // Act + Assert
        assertThat(Piece.fromFen(lettre)).isEqualTo(new Piece(couleur, type));
    }

    @ParameterizedTest(name = "''{0}'' est refusée")
    @ValueSource(chars = {'x', 'X', '1', ' '})
    @DisplayName("une lettre qui n'est pas une pièce est refusée")
    void uneLettreQuiNestPasUnePieceEstRefusee(char lettre) {
        // Act + Assert
        assertThatThrownBy(() -> Piece.fromFen(lettre)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest(name = "{2} {1} → ''{0}''")
    @MethodSource("lettresFen")
    @DisplayName("chaque pièce s'écrit avec sa lettre FEN")
    void chaquePieceSEcritAvecSaLettreFen(char lettre, Color couleur, PieceType type) {
        // Act + Assert
        assertThat(new Piece(couleur, type).toFen()).isEqualTo(lettre);
    }
}
