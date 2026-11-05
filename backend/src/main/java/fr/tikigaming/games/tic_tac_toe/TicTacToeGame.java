package fr.tikigaming.games.tic_tac_toe;

import java.util.Optional;

public final class TicTacToeGame {

    private static final int BOARD_SIZE = 3;
    private final Mark[][] board = new Mark[BOARD_SIZE][BOARD_SIZE];
    private Mark currentPlayer = Mark.X;
    private GameStatus status = GameStatus.IN_PROGRESS;

    public int boardSize() {
        return BOARD_SIZE;
    }

    public Mark currentPlayer() {
        return currentPlayer;
    }

    public GameStatus status() {
        return status;
    }

    public Optional<Mark> cell(int row, int column) {
        validateCoordinates(row, column);
        return Optional.ofNullable(board[row][column]);
    }

    public void place(int row, int column) {
        if (status != GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("La partie est terminée.");
        }
        validateCoordinates(row, column);
        if (board[row][column] != null) {
            throw new IllegalArgumentException("La case est déjà occupée.");
        }

        board[row][column] = currentPlayer;
        status = determineStatus(currentPlayer);
        if (status == GameStatus.IN_PROGRESS) {
            currentPlayer = otherPlayer(currentPlayer);
        }
    }

    private GameStatus determineStatus(Mark player) {
        if (hasWinningLine(player)) {
            return player == Mark.X ? GameStatus.X_WON : GameStatus.O_WON;
        }
        for (int row = 0; row < BOARD_SIZE; row++) {
            for (int column = 0; column < BOARD_SIZE; column++) {
                if (board[row][column] == null) {
                    return GameStatus.IN_PROGRESS;
                }
            }
        }
        return GameStatus.DRAW;
    }

    private boolean hasWinningLine(Mark player) {
        for (int index = 0; index < BOARD_SIZE; index++) {
            if (board[index][0] == player && board[index][1] == player && board[index][2] == player) {
                return true;
            }
            if (board[0][index] == player && board[1][index] == player && board[2][index] == player) {
                return true;
            }
        }
        return (board[0][0] == player && board[1][1] == player && board[2][2] == player)
                || (board[0][2] == player && board[1][1] == player && board[2][0] == player);
    }

    private static Mark otherPlayer(Mark player) {
        return player == Mark.X ? Mark.O : Mark.X;
    }

    private static void validateCoordinates(int row, int column) {
        if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) {
            throw new IllegalArgumentException("Les coordonnées doivent être comprises entre 0 et 2.");
        }
    }
}
