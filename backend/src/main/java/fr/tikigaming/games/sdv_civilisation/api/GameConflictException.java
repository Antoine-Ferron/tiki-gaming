package fr.tikigaming.games.sdv_civilisation.api;

/** Coup refusé parce que la partie a avancé sans lui ; porte la partie à jour pour que le front se resynchronise. */
public class GameConflictException extends RuntimeException {

    private final transient GameView game;

    public GameConflictException(String message, GameView game) {
        super(message);
        this.game = game;
    }

    public GameView game() {
        return game;
    }
}
