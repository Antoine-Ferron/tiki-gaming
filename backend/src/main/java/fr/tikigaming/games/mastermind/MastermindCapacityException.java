package fr.tikigaming.games.mastermind;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

public class MastermindCapacityException extends ApiException {
    public MastermindCapacityException(String message) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
