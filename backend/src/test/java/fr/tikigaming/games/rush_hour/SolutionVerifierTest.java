package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

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
}
