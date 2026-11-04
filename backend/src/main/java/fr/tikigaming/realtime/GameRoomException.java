package fr.tikigaming.realtime;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Refus d'une création, jonction ou action sur une salle, traduit par {@code ApiExceptionHandler}. */
public class GameRoomException extends ApiException {
    public GameRoomException(HttpStatus status, String message) {
        super(status, message);
    }
}
