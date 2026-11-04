package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Mêmes cas que frontend/src/games/rush-hour/domain/solver.test.ts. */
class SolverTest {

    private static final String E = "......";

    @Test
    void solvedBoardNeedsNoMove() {
        // Arrange
        Board board = Board.parse(List.of(E, E, "....XX", E, E, E));

        // Act + Assert
        assertThat(Solver.minimumMoves(board)).hasValue(0);
    }

    @Test
    void freeRedCarLeavesInOneSlide() {
        // Arrange
        Board board = Board.parse(List.of(E, E, "XX....", E, E, E));

        // Act + Assert
        assertThat(Solver.minimumMoves(board)).hasValue(1);
    }

    @Test
    void blockingTruckMustMoveFirst() {
        // Arrange : le camion A doit monter avant que la voiture rouge sorte
        Board board = Board.parse(List.of(E, "....A.", "XX..A.", E, E, E));

        // Act + Assert
        assertThat(Solver.minimumMoves(board)).hasValue(2);
    }

    @Test
    void impossibleBoardHasNoSolution() {
        // Arrange : un véhicule horizontal sur la ligne de sortie, devant la voiture rouge
        Board board = Board.parse(List.of(E, E, "XX.AA.", E, E, E));

        // Act + Assert
        assertThat(Solver.minimumMoves(board)).isEmpty();
    }
}
