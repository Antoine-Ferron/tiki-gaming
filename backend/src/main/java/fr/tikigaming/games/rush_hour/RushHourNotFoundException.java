package fr.tikigaming.games.rush_hour;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Niveau inconnu : 404. */
public class RushHourNotFoundException extends ApiException {
    public RushHourNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
