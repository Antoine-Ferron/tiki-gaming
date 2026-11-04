package fr.tikigaming.games.sdv_civilisation.api;

/** Aucune partie en cours pour ce joueur. */
public class NoGameException extends RuntimeException {

    public NoGameException() {
        super("Aucune partie en cours : commence une nouvelle partie.");
    }
}
