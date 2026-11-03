package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
}
