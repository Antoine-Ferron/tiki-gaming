package fr.tikigaming.config;

import org.springframework.http.HttpStatus;

/**
 * Erreur métier qui porte son statut HTTP. Son message s'adresse au joueur : {@link ApiExceptionHandler} le renvoie
 * tel quel, au format {@code { "error": "message" }}.
 */
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
