package fr.tikigaming.games.dame.api;

import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import fr.tikigaming.games.dame.persistence.MatchStorageException;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Traduction locale : aucun changement du gestionnaire d'erreurs de la plateforme. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = DameController.class)
public class DameApiErrors {
    @ExceptionHandler(MatchStorageException.class)
    ResponseEntity<ApiError> storageUnavailable() {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError("La rencontre n'a pas pu être enregistrée. Réessaie.", Map.of()));
    }
}
