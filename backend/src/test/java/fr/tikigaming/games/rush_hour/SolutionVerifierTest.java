package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** Le serveur rejoue les coups envoyés par le front avant d'accepter une partie (anti-triche). */
class SolutionVerifierTest {

    private static final String E = "......";
    /** La voiture rouge est bloquée par le camion A, qui doit monter d'une case. */
    private static final List<String> BLOCKED = List.of(E, "....A.", "XX..A.", E, E, E);

    @Test
    void replayCountsTheMovesOfAWinningGame() {
        // Act
        int moves = SolutionVerifier.replay(BLOCKED, List.of(new Move('A', -1), new Move('X', 4)));

        // Assert
        assertThat(moves).isEqualTo(2);
    }

    @Test
    void replayCountsSuccessiveSlidesOfTheSameVehicleAsOneMove() {
        // Act : au clavier, la voiture rouge avance case par case
        int moves = SolutionVerifier.replay(
                List.of(E, E, "XX....", E, E, E), List.of(new Move('X', 1), new Move('X', 1), new Move('X', 2)));

        // Assert
        assertThat(moves).isEqualTo(1);
    }

    @Test
    void replayDropsABackAndForthOfTheSameVehicle() {
        // Act : X avance puis recule (0 coup), puis A monte et X sort
        int moves = SolutionVerifier.replay(
                BLOCKED, List.of(new Move('X', 1), new Move('X', -1), new Move('A', -1), new Move('X', 4)));

        // Assert
        assertThat(moves).isEqualTo(2);
    }

    @Test
    void replayCountsAMergedMoveFollowedByAnotherVehicle() {
        // Arrange : la voiture B, en bas à gauche, ne gêne pas la voiture rouge
        List<String> map = List.of(E, E, "XX....", "B.....", "B.....", E);

        // Act : X avance en deux fois (1 coup), B descend (1 coup), puis X sort (1 coup)
        int moves = SolutionVerifier.replay(
                map, List.of(new Move('X', 1), new Move('X', 1), new Move('B', 1), new Move('X', 2)));

        // Assert
        assertThat(moves).isEqualTo(3);
    }

    @Test
    void replayRefusesAVehicleBackingIntoAnother() {
        // Arrange : la voiture B est juste derrière la voiture rouge
        List<String> map = List.of(E, ".B....", ".BXX..", E, E, E);

        // Act + Assert
        assertThatThrownBy(() -> SolutionVerifier.replay(map, List.of(new Move('X', -1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Déplacement impossible : X de -1");
    }

    @Test
    void replayRefusesAVehicleGoingPastTheRightEdge() {
        // Arrange : ligne libre, et la case qui suit le bord (début de la ligne suivante) aussi
        List<String> map = List.of(E, E, "XX....", E, E, E);

        // Act + Assert : 4 cases pour sortir (bord), 5 cases dépassent le plateau
        assertThatThrownBy(() -> SolutionVerifier.replay(map, List.of(new Move('X', 5))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Déplacement impossible : X de 5");
    }

    static Stream<Arguments> refusedGames() {
        return Stream.of(
                Arguments.of(List.of(new Move('Z', 1)), "Véhicule inconnu : Z"),
                Arguments.of(List.of(new Move('X', 0)), "Déplacement nul"),
                Arguments.of(List.of(new Move('X', 3)), "Déplacement impossible : X de 3"), // traverse le camion A
                Arguments.of(List.of(new Move('X', -1)), "Déplacement impossible : X de -1"), // sort du plateau
                Arguments.of(List.of(new Move('A', -1)), "La voiture rouge n’est pas sortie"));
    }

    @ParameterizedTest(name = "refuse : {1}")
    @MethodSource("refusedGames")
    void replayRefusesAnIllegalOrUnfinishedGame(List<Move> moves, String message) {
        // Act + Assert
        assertThatThrownBy(() -> SolutionVerifier.replay(BLOCKED, moves))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(message);
    }
}
