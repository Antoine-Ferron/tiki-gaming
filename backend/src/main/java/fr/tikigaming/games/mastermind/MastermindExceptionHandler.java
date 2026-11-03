package fr.tikigaming.games.mastermind;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = MastermindController.class)
@Order(0)
class MastermindExceptionHandler {
    record ApiError(String error, @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, String> fields) {}

    @ExceptionHandler(MastermindNotFoundException.class)
    ResponseEntity<ApiError> handleNotFound(MastermindNotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    @ExceptionHandler(MastermindFinishedException.class)
    ResponseEntity<ApiError> handleFinished(MastermindFinishedException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler(MastermindValidationException.class)
    ResponseEntity<ApiError> handleValidation(MastermindValidationException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    @ExceptionHandler(MastermindCapacityException.class)
    ResponseEntity<ApiError> handleCapacity(MastermindCapacityException exception) {
        return error(HttpStatus.TOO_MANY_REQUESTS, exception);
    }

    private static ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(exception.getMessage(), Map.of()));
    }
}
