package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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

    @Test
    @DisplayName("une case vide n'a aucune destination")
    void uneCaseVideNaAucuneDestination() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/8/8/8/4K3 w - - 0 1");

        // Act + Assert
        assertThat(MoveGenerator.destinations(position, Square.of("d4"))).isEmpty();
    }

    @Test
    @DisplayName("un roi au centre (d4) a 8 cases possibles (règle D2)")
    void unRoiAuCentreA8Cases() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/3K4/8/8/8 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations).isEqualTo(squares("c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"));
    }

    @ParameterizedTest(name = "roi en {1} → {2} cases")
    @CsvSource({
        "4k3/8/8/8/3K4/8/8/8 w - - 0 1, d4, 8", // centre
        "4k3/8/8/8/K7/8/8/8 w - - 0 1, a4, 5", // bord
        "4k3/8/8/8/8/8/8/K7 w - - 0 1, a1, 3", // coin
        "K3k3/8/8/8/8/8/8/8 w - - 0 1, a8, 3" // autre coin
    })
    @DisplayName("un roi a 8 cases au centre, 5 au bord, 3 dans un coin (valeurs limites)")
    void unRoiA8CasesAuCentre5AuBord3DansUnCoin(String fen, String square, int expected) {
        // Act + Assert
        assertThat(MoveGenerator.destinations(Fen.parse(fen), Square.of(square)))
                .hasSize(expected);
    }

    @Test
    @DisplayName("un cavalier dans le coin opposé (h8) n'a que 2 cases (sortie par la colonne h)")
    void unCavalierDansLeCoinH8NaQue2Cases() {
        // Arrange
        Position position = Fen.parse("4k2N/8/8/8/8/8/8/4K3 w - - 0 1");

        // Act + Assert
        assertThat(MoveGenerator.destinations(position, Square.of("h8"))).isEqualTo(squares("f7", "g6"));
    }

    @Test
    @DisplayName("une tour sur un échiquier libre (d4) a 14 cases : toute sa colonne et toute sa rangée (règle D4)")
    void uneTourSurUnEchiquierLibreA14Cases() {
        // Arrange : rois en a8 et h1, hors des lignes de la tour
        Position position = Fen.parse("k7/8/8/8/3R4/8/8/7K w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations)
                .isEqualTo(squares("d1", "d2", "d3", "d5", "d6", "d7", "d8", "a4", "b4", "c4", "e4", "f4", "g4", "h4"));
    }

    @Test
    @DisplayName("une tour s'arrête avant une pièce de son camp (règle D4 : elle ne saute pas)")
    void uneTourSArreteAvantUnePieceAmie() {
        // Arrange : pion blanc en d6, au-dessus de la tour blanche en d4
        Position position = Fen.parse("k7/8/3P4/8/3R4/8/8/7K w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert : vers le haut, seulement d5 ; ni d6 (son pion), ni d7, d8 (derrière)
        assertThat(destinations)
                .contains(Square.of("d5"))
                .doesNotContain(squares("d6", "d7", "d8").toArray(Square[]::new));
    }

    @Test
    @DisplayName("une tour peut prendre une pièce adverse, puis s'arrête dessus (règle D4)")
    void uneTourPrendUnePieceAdversePuisSArrete() {
        // Arrange : pion noir en d6, au-dessus de la tour blanche en d4
        Position position = Fen.parse("k7/8/3p4/8/3R4/8/8/7K w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert : d5 et d6 (prise) ; pas d7 ni d8, derrière le pion pris
        assertThat(destinations)
                .contains(Square.of("d5"), Square.of("d6"))
                .doesNotContain(Square.of("d7"), Square.of("d8"));
    }

    @Test
    @DisplayName("un fou sur un échiquier libre (d4) a 13 cases sur ses deux diagonales (règle D5)")
    void unFouSurUnEchiquierLibreA13Cases() {
        // Arrange : rois en a8 et h1, hors des diagonales du fou
        Position position = Fen.parse("k7/8/8/8/3B4/8/8/7K w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations)
                .isEqualTo(squares("a1", "b2", "c3", "e5", "f6", "g7", "h8", "a7", "b6", "c5", "e3", "f2", "g1"));
    }

    @Test
    @DisplayName("un fou dans un coin (a1) n'a qu'une diagonale : 7 cases (valeur limite)")
    void unFouDansUnCoinA7Cases() {
        // Arrange
        Position position = Fen.parse("k7/8/8/8/8/8/8/B6K w - - 0 1");

        // Act + Assert
        assertThat(MoveGenerator.destinations(position, Square.of("a1")))
                .isEqualTo(squares("b2", "c3", "d4", "e5", "f6", "g7", "h8"));
    }

    @Test
    @DisplayName("un fou s'arrête avant une pièce amie et sur une pièce adverse")
    void unFouSArreteAvantUnePieceAmieEtSurUnePieceAdverse() {
        // Arrange : pion blanc en f6 (bloque), pion noir en b2 (prise)
        Position position = Fen.parse("k7/8/5P2/8/3B4/8/1p6/7K w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations)
                .contains(Square.of("e5"), Square.of("c3"), Square.of("b2"))
                .doesNotContain(Square.of("f6"), Square.of("g7"), Square.of("h8"), Square.of("a1"));
    }

    private static Set<Square> squares(String... notations) {
        return Arrays.stream(notations).map(Square::of).collect(Collectors.toSet());
    }
}
