package fr.tikigaming.mastermind;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
public class MastermindController {
    private final MastermindService service;

    public MastermindController(MastermindService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<MastermindGameSnapshot> create() {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create());
    }

    @GetMapping("/{id}")
    MastermindGameSnapshot get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/{id}/guesses")
    MastermindGameSnapshot guess(@PathVariable UUID id, @Valid @RequestBody GuessRequest request) {
        return service.guess(id, request.parsedColors());
    }

    @PostMapping("/{id}/restart")
    MastermindGameSnapshot restart(@PathVariable UUID id) {
        return service.restart(id);
    }

    record GuessRequest(@NotNull List<String> colors) {
        List<MastermindColor> parsedColors() {
            try {
                if (colors == null || colors.size() != MastermindGame.CODE_LENGTH) {
                    throw new MastermindValidationException("Une proposition doit contenir exactement 4 couleurs valides.");
                }
                return colors.stream().map(MastermindColor::fromValue).toList();
            } catch (MastermindValidationException e) {
                throw e;
            } catch (RuntimeException e) {
                throw new MastermindValidationException("Proposition invalide.");
            }
        }
    }

    @ExceptionHandler(MastermindNotFoundException.class)
    ResponseEntity<Map<String, String>> notFound(MastermindNotFoundException e) {
        return error(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(MastermindFinishedException.class)
    ResponseEntity<Map<String, String>> finished(MastermindFinishedException e) {
        return error(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler({MastermindValidationException.class, IllegalArgumentException.class})
    ResponseEntity<Map<String, String>> invalid(Exception e) {
        return error(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
