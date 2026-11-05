package fr.tikigaming.games.dame.persistence;

/** Panne technique du stockage ; ne contient pas la réponse interne du fournisseur. */
public final class MatchStorageException extends RuntimeException {

    public MatchStorageException(Throwable cause) {
        super("Le stockage des rencontres est indisponible. Réessaie plus tard.", cause);
    }
}
