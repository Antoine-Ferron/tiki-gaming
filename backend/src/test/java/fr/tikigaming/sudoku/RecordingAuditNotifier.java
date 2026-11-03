package fr.tikigaming.sudoku;

import java.util.ArrayList;
import java.util.List;

/** Double de test : garde en mémoire les événements reçus, dans l'ordre. */
final class RecordingAuditNotifier implements AuditNotifier {

    private final List<AuditEvent> events = new ArrayList<>();

    @Override
    public void notify(AuditEvent event) {
        events.add(event);
    }

    List<AuditEvent> events() {
        return List.copyOf(events);
    }
}
