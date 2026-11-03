package fr.tikigaming.games;

/**
 * Action de jeu refusée : le message s'adresse au joueur, le statut est celui de la réponse HTTP. Mise en forme par
 * {@code config/ApiExceptionHandler}, comme les autres erreurs de l'API.
 */
public class GameException extends RuntimeException {

    private final int status;

    public GameException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
