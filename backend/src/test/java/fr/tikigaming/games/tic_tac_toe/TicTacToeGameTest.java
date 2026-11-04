package fr.tikigaming.games.tic_tac_toe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TicTacToeGameTest {

    @Test
    void startsWithAnEmptyThreeByThreeBoardAndXTurn() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        int boardSize = game.boardSize();

        // Assert
        assertThat(boardSize).isEqualTo(3);
        assertThat(game.currentPlayer()).isEqualTo(Mark.X);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        for (int row = 0; row < boardSize; row++) {
            for (int column = 0; column < boardSize; column++) {
                assertThat(game.cell(row, column)).isEmpty();
            }
        }
    }

    @Test
    void alternatesPlayersAfterEachValidMove() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        game.place(0, 0);
        Mark playerAfterX = game.currentPlayer();
        game.place(1, 1);

        // Assert
        assertThat(playerAfterX).isEqualTo(Mark.O);
        assertThat(game.cell(0, 0)).contains(Mark.X);
        assertThat(game.cell(1, 1)).contains(Mark.O);
        assertThat(game.currentPlayer()).isEqualTo(Mark.X);
    }

    @Test
    void rejectsOutsideCoordinatesAndOccupiedCells() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();
        game.place(0, 0);

        // Act and Assert
        assertThatThrownBy(() -> game.place(-1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> game.place(3, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> game.place(0, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void detectsAHorizontalWin() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        play(game, 0, 0, 1, 0, 0, 1, 1, 1, 0, 2);

        // Assert
        assertThat(game.status()).isEqualTo(GameStatus.X_WON);
    }

    @Test
    void detectsAVerticalWin() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        play(game, 0, 0, 0, 1, 1, 0, 1, 1, 2, 0);

        // Assert
        assertThat(game.status()).isEqualTo(GameStatus.X_WON);
    }

    @Test
    void detectsADiagonalWin() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        play(game, 0, 0, 0, 1, 1, 1, 0, 2, 2, 2);

        // Assert
        assertThat(game.status()).isEqualTo(GameStatus.X_WON);
    }

    @Test
    void detectsAnOWin() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        play(game, 0, 0, 1, 0, 0, 1, 1, 1, 2, 2, 1, 2);

        // Assert
        assertThat(game.status()).isEqualTo(GameStatus.O_WON);
    }

    @Test
    void detectsADrawWhenTheBoardIsFullWithoutAWinner() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();

        // Act
        play(game, 0, 0, 0, 1, 0, 2, 1, 1, 1, 0, 1, 2, 2, 1, 2, 0, 2, 2);

        // Assert
        assertThat(game.status()).isEqualTo(GameStatus.DRAW);
    }

    @Test
    void rejectsMovesAfterTheGameHasEnded() {
        // Arrange
        TicTacToeGame game = new TicTacToeGame();
        play(game, 0, 0, 1, 0, 0, 1, 1, 1, 0, 2);

        // Act and Assert
        assertThatThrownBy(() -> game.place(2, 2)).isInstanceOf(IllegalStateException.class);
    }

    private static void play(TicTacToeGame game, int... coordinates) {
        if (coordinates.length % 2 != 0) {
            throw new IllegalArgumentException("Chaque coup doit fournir une ligne et une colonne.");
        }
        for (int index = 0; index + 1 < coordinates.length; index += 2) {
            game.place(coordinates[index], coordinates[index + 1]);
        }
    }
}
