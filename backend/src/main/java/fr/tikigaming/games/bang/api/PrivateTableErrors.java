package fr.tikigaming.games.bang.api;

import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = PrivateTableController.class)
class PrivateTableErrors {

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> handleTableError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new ApiError(error.getReason(), Map.of()));
    }
}
