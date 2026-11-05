package fr.tikigaming.games.mastermind;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/mastermind")
@Tag(name = "mastermind", description = "Parties de Mastermind")
public class MastermindController {
    private final MastermindService service;

    public MastermindController(MastermindService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Créer une partie")
    @ApiResponse(responseCode = "201", description = "Partie créée")
    @ApiResponse(responseCode = "429", description = "Trop de parties actives, au total ou pour ce client")
    ResponseEntity<MastermindGameSnapshot> create(HttpServletRequest request) {
        // Derrière le proxy, l'adresse du joueur vient de X-Forwarded-For (server.forward-headers-strategy).
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request.getRemoteAddr()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter une partie")
    @ApiResponse(responseCode = "200", description = "État de la partie")
    @ApiResponse(responseCode = "404", description = "Partie introuvable")
    MastermindGameSnapshot get(@PathVariable UUID id, HttpServletRequest request) {
        return service.get(id, request.getRemoteAddr());
    }

    @PostMapping("/{id}/guesses")
    @Operation(summary = "Proposer une combinaison")
    @ApiResponse(responseCode = "200", description = "État mis à jour")
    @ApiResponse(responseCode = "400", description = "Combinaison invalide")
    @ApiResponse(responseCode = "404", description = "Partie introuvable")
    @ApiResponse(responseCode = "409", description = "Partie déjà terminée")
    MastermindGameSnapshot guess(
            @PathVariable UUID id, @Valid @RequestBody GuessRequest request, HttpServletRequest httpRequest) {
        return service.guess(id, httpRequest.getRemoteAddr(), request.parsedColors());
    }

    @PostMapping("/{id}/restart")
    @Operation(summary = "Recommencer une partie")
    @ApiResponse(responseCode = "200", description = "Nouvelle partie")
    @ApiResponse(responseCode = "404", description = "Partie introuvable")
    MastermindGameSnapshot restart(@PathVariable UUID id, HttpServletRequest request) {
        return service.restart(id, request.getRemoteAddr());
    }

    record GuessRequest(@NotNull List<String> colors) {
        List<MastermindColor> parsedColors() {
            try {
                if (colors == null || colors.size() != MastermindGame.CODE_LENGTH) {
                    throw new MastermindValidationException(
                            "Une proposition doit contenir exactement 4 couleurs valides.");
                }
                return colors.stream().map(MastermindColor::fromValue).toList();
            } catch (MastermindValidationException e) {
                throw e;
            } catch (RuntimeException e) {
                throw new MastermindValidationException("Proposition invalide.");
            }
        }
    }
}
