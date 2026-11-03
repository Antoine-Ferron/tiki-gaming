package fr.tikigaming.games.dame;

/** État initialisable pour les fixtures ; commandes du moteur encore RED. */
public class Game {

    private final Board board;
    private final Player currentPlayer;

    public Game() {
        this(Board.initial(), Player.WHITE);
    }

    public Game(Board board, Player currentPlayer) {
        this.board = board;
        this.currentPlayer = currentPlayer;
    }

    public Board board() {
        return board;
    }

    public Player currentPlayer() {
        return currentPlayer;
    }

    public GameStatus status() {
        return GameStatus.IN_PROGRESS;
    }

    public void play(Move move) {
        throw new UnsupportedOperationException("Moteur non implémenté : phase RED.");
    }

    public void reset() {
        throw new UnsupportedOperationException("Réinitialisation non implémentée : phase RED.");
    }
}
