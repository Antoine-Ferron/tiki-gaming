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

    // Niveau 1 : la voiture rouge (X) est bloquée par le camion C, qui doit descendre d'une case.
    private static final List<String> LEVEL_1 = List.of(".HFFD.", ".HGGD.", "I.XX.C", "IBBL.C", ".EELAC", "JJKKA.");

    @Test
    void acceptsMovesThatBringTheRedCarOut() {
        // Arrange
        List<Move> moves = List.of(new Move('C', 1), new Move('X', 2));

        // Act
        boolean valid = SolutionVerifier.isValidSolution(LEVEL_1, moves);

        // Assert
        assertThat(valid).isTrue();
    }

    @Test
    void rejectsMoveThroughAnotherVehicle() {
        // Arrange : X avance de 2 cases sans que C ait bougé, il traverserait le camion
        List<Move> moves = List.of(new Move('X', 2));

        // Act
        boolean valid = SolutionVerifier.isValidSolution(LEVEL_1, moves);

        // Assert
        assertThat(valid).isFalse();
    }

    // --- replay : le serveur rejoue la partie et compte les coups comme le front (R6) ---

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
