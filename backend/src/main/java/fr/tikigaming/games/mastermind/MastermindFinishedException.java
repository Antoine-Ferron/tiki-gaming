package fr.tikigaming.games.mastermind;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

public class MastermindFinishedException extends ApiException {
    public MastermindFinishedException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
