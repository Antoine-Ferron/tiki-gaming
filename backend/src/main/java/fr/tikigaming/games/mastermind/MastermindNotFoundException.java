package fr.tikigaming.games.mastermind;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

public class MastermindNotFoundException extends ApiException {
    public MastermindNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
