package fr.tikigaming.games.echecs.api;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Entrée mal écrite ou absente (FEN, case) : 400. Distincte d'un coup refusé par les règles (422). */
public class EchecsInvalidInputException extends ApiException {

    public EchecsInvalidInputException(String reason) {
        super(HttpStatus.BAD_REQUEST, "Entrée invalide : " + reason);
    }
}
