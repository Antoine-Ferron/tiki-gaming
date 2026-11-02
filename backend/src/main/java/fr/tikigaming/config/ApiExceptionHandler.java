package fr.tikigaming.config;

import fr.tikigaming.auth.AuthException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;

/**
 * Format unique des erreurs de l'API : {@code { "error": "message", "fields": { "champ": "message" } }}. Le message
 * s'adresse au joueur : jamais de détail technique, qui va dans les logs.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    static final String INVALID_FIELDS = "Certains champs sont invalides.";
    static final String INVALID_REQUEST = "Requête invalide.";
    static final String AUTH_UNAVAILABLE = "Le service d'authentification rencontre un problème. Réessaie plus tard.";
    static final String AUTH_UNREACHABLE = "Service d'authentification injoignable. Réessaie plus tard.";
    static final String UNEXPECTED = "Une erreur inattendue est survenue. Réessaie plus tard.";

    // Un champ vide déclenche parfois plusieurs contraintes : « requis » est le message le plus utile.
    private static final List<String> REQUIRED_CODES = List.of("NotNull", "NotBlank", "NotEmpty");

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> handleInvalidFields(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().stream()
                .sorted(Comparator.comparing(error -> REQUIRED_CODES.contains(error.getCode()) ? 0 : 1))
                .forEach(error -> fields.putIfAbsent(error.getField(), message(error)));
        log.debug("Requête refusée, champs invalides : {}", fields.keySet());
        String error = fields.size() == 1 ? fields.values().iterator().next() : INVALID_FIELDS;
        return ResponseEntity.badRequest().body(Map.of("error", error, "fields", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException e) {
        log.debug("Corps de requête illisible : {}", e.getMessage());
        return error(HttpStatus.BAD_REQUEST, INVALID_REQUEST);
    }

    @ExceptionHandler(AuthException.class)
    ResponseEntity<Map<String, Object>> handleAuthError(AuthException e) {
        if (e.status() >= 400 && e.status() < 500) {
            log.debug("Refus du service d'authentification ({}) : {}", e.status(), e.getMessage());
            return error(HttpStatusCode.valueOf(e.status()), e.getMessage());
        }
        // Les erreurs 5xx de Supabase sont remontées comme une passerelle en échec, sans leur détail.
        log.warn("Supabase a répondu {} : {}", e.status(), e.getMessage());
        return error(HttpStatus.BAD_GATEWAY, AUTH_UNAVAILABLE);
    }

    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<Map<String, Object>> handleSupabaseUnreachable(ResourceAccessException e) {
        log.error("Supabase injoignable", e);
        return error(HttpStatus.BAD_GATEWAY, AUTH_UNREACHABLE);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> handleUnexpected(Exception e, HttpServletRequest request) {
        // Exceptions standard de Spring MVC (404, 405, 415…) : leur statut est le bon.
        if (e instanceof ErrorResponse response && !response.getStatusCode().is5xxServerError()) {
            log.debug("{} {} : {}", request.getMethod(), request.getRequestURI(), e.getMessage());
            return error(response.getStatusCode(), INVALID_REQUEST);
        }
        log.error("Erreur inattendue sur {} {}", request.getMethod(), request.getRequestURI(), e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, UNEXPECTED);
    }

    private static String message(FieldError error) {
        return error.getDefaultMessage() != null ? error.getDefaultMessage() : INVALID_REQUEST;
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatusCode status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
