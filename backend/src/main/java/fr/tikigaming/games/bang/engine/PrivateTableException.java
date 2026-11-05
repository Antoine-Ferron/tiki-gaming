package fr.tikigaming.games.bang.engine;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Refus d'une opération sur une table privée, traduit par {@code ApiExceptionHandler} avec son statut. */
public class PrivateTableException extends ApiException {
    public PrivateTableException(HttpStatus status, String message) {
        super(status, message);
    }
}
