package fr.tikigaming.games.dame;

/** État d'une partie locale ; chaque commande acceptée remplace atomiquement sa position. */
public class Game {

    private final GameRules rules = new GameRules();
    private Board board;
    private Player currentPlayer;
    private GameStatus status;
    private DrawState drawState;

    public Game() {
        this(Board.initial(), Player.WHITE);
    }

    public Game(Board board, Player currentPlayer) {
        this(board, currentPlayer, DrawState.initial(board, currentPlayer));
    }

    public Game(Board board, Player currentPlayer, DrawState drawState) {
        this.board = board;
        this.currentPlayer = currentPlayer;
        this.drawState = java.util.Objects.requireNonNull(drawState);
        this.status = result(board, currentPlayer, drawState);
    }

    public DrawState drawState() {
        return drawState;
    }

    private GameStatus result(Board position, Player player, DrawState history) {
        GameStatus victory = rules.status(position, player);
        return victory == GameStatus.IN_PROGRESS && history.drawn(position, player) ? GameStatus.DRAW : victory;
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
        DrawState nextDrawState = drawState.after(board, move, nextBoard, nextPlayer);
        GameStatus nextStatus = result(nextBoard, nextPlayer, nextDrawState);

        board = nextBoard;
        currentPlayer = nextPlayer;
        status = nextStatus;
        drawState = nextDrawState;
    }

    public void reset() {
        Board initialBoard = Board.initial();
        board = initialBoard;
        currentPlayer = Player.WHITE;
        status = GameStatus.IN_PROGRESS;
        drawState = DrawState.initial(initialBoard, Player.WHITE);
    }
}
