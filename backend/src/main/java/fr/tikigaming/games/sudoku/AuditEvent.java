package fr.tikigaming.games.sudoku;

import java.time.Instant;
import java.util.Map;

/** Fait à tracer (ex. partie terminée). Immuable : les détails sont copiés à la construction. */
public record AuditEvent(String type, Instant at, Map<String, String> details) {

    public AuditEvent {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Type d'événement manquant");
        }
        if (at == null) {
            throw new IllegalArgumentException("Date de l'événement manquante");
        }
        details = Map.copyOf(details);
    }
}
