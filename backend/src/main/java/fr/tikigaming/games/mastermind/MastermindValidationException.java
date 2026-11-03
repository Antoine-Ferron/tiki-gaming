package fr.tikigaming.games.mastermind;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

public class MastermindValidationException extends ApiException {
    public MastermindValidationException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
