package fr.tikigaming.games.dame;

/** État d'une partie locale ; chaque commande acceptée remplace atomiquement sa position. */
public class Game {

    private final GameRules rules = new GameRules();
    private Board board;
    private Player currentPlayer;
    private GameStatus status;

    public Game() {
        this(Board.initial(), Player.WHITE);
    }

    public Game(Board board, Player currentPlayer) {
        this.board = board;
        this.currentPlayer = currentPlayer;
        this.status = rules.status(board, currentPlayer);
    }

    public Board board() {
        return board;
    }

    public Player currentPlayer() {
        return currentPlayer;
    }

    public GameStatus status() {
        return status;
    }

    public void play(Move move) {
        if (status != GameStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("La partie est terminée. Réinitialise-la pour rejouer.");
        }

        Board nextBoard = rules.apply(board, currentPlayer, move);
        Player nextPlayer = currentPlayer == Player.WHITE ? Player.BLACK : Player.WHITE;
        GameStatus nextStatus = rules.status(nextBoard, nextPlayer);

        board = nextBoard;
        currentPlayer = nextPlayer;
        status = nextStatus;
    }

    public void reset() {
        Board initialBoard = Board.initial();
        board = initialBoard;
        currentPlayer = Player.WHITE;
        status = GameStatus.IN_PROGRESS;
    }
}
