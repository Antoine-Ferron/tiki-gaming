package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MoveGeneratorTest {

    @Test
    @DisplayName("un cavalier au centre (d4) a 8 cases possibles (règle D6)")
    void unCavalierAuCentreA8Cases() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations).isEqualTo(squares("b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"));
    }

    @Test
    @DisplayName("un cavalier dans le coin (a1) n'a que 2 cases possibles (valeur limite)")
    void unCavalierDansLeCoinNaQue2Cases() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/8/8/8/N3K3 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("a1"));

        // Assert
        assertThat(destinations).isEqualTo(squares("b3", "c2"));
    }

    @Test
    @DisplayName("un cavalier au bord (a4) a 4 cases possibles")
    void unCavalierAuBordA4Cases() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/N7/8/8/4K3 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("a4"));

        // Assert
        assertThat(destinations).isEqualTo(squares("b2", "b6", "c3", "c5"));
    }

    @Test
    @DisplayName("un cavalier ne va pas sur une case occupée par une pièce de son camp (règle D1)")
    void unCavalierNeVaPasSurUnePieceAmie() {
        // Arrange : pion blanc en e6, une des cases du cavalier blanc en d4
        Position position = Fen.parse("4k3/8/4P3/8/3N4/8/8/4K3 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations).isEqualTo(squares("b3", "b5", "c2", "c6", "e2", "f3", "f5"));
    }

    @Test
    @DisplayName("un cavalier peut prendre une pièce adverse (règle D1)")
    void unCavalierPeutPrendreUnePieceAdverse() {
        // Arrange : pion noir en e6
        Position position = Fen.parse("4k3/8/4p3/8/3N4/8/8/4K3 w - - 0 1");

        // Act + Assert
        assertThat(MoveGenerator.destinations(position, Square.of("d4"))).contains(Square.of("e6"));
    }

    @Test
    @DisplayName("un cavalier saute par-dessus les pièces : en b1 au départ, il va en a3 et c3")
    void unCavalierSauteParDessusLesPieces() {
        // Arrange : position de départ, le cavalier b1 est entouré de pions
        Position position = Fen.parse("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

        // Act + Assert
        assertThat(MoveGenerator.destinations(position, Square.of("b1"))).isEqualTo(squares("a3", "c3"));
    }

    private static Set<Square> squares(String... notations) {
        return Arrays.stream(notations).map(Square::of).collect(Collectors.toSet());
    }
}
