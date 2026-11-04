package fr.tikigaming.games.bang.engine;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Refus d'une création ou d'une jonction, traduit par {@code ApiExceptionHandler} avec son statut. */
public class PrivateTableException extends ApiException {
    public PrivateTableException(HttpStatus status, String message) {
        super(status, message);
    }
}
