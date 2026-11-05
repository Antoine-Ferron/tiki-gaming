package fr.tikigaming.games.echecs.api;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Coup refusé par les règles (case vide, mauvais camp, case inaccessible) : 422. */
public class EchecsRejectedException extends ApiException {

    public EchecsRejectedException(String reason) {
        super(HttpStatus.UNPROCESSABLE_CONTENT, "Coup refusé : " + reason);
    }
}
