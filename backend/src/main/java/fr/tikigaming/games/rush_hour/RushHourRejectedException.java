package fr.tikigaming.games.rush_hour;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Partie refusée (coup illégal, voiture rouge non sortie, score impossible) : 422. */
public class RushHourRejectedException extends ApiException {
    public RushHourRejectedException(String reason) {
        super(HttpStatus.UNPROCESSABLE_CONTENT, "Partie refusée : " + reason);
    }
}
