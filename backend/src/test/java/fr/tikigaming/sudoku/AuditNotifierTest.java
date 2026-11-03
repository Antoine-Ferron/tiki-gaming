package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuditNotifierTest {

    private static final Instant AT = Instant.parse("2026-11-03T10:00:00Z");

    @Test
    void recordsEventsInOrder() {
        RecordingAuditNotifier notifier = new RecordingAuditNotifier();
        AuditEvent started = new AuditEvent("GAME_STARTED", AT, Map.of("difficulty", "easy"));
        AuditEvent finished = new AuditEvent("GAME_FINISHED", AT.plusSeconds(540), Map.of("score", "1166"));

        notifier.notify(started);
        notifier.notify(finished);

        assertThat(notifier.events()).containsExactly(started, finished);
    }

    @Test
    void startsEmpty() {
        assertThat(new RecordingAuditNotifier().events()).isEmpty();
    }

    @Test
    void eventDetailsAreCopiedAndImmutable() {
        Map<String, String> details = new HashMap<>();
        details.put("score", "1166");

        AuditEvent event = new AuditEvent("GAME_FINISHED", AT, details);
        details.put("score", "9999");

        assertThat(event.details()).containsEntry("score", "1166");
        assertThatThrownBy(() -> event.details().put("x", "y")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void rejectsMissingTypeOrDate() {
        assertThatThrownBy(() -> new AuditEvent(" ", AT, Map.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AuditEvent(null, AT, Map.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AuditEvent("GAME_STARTED", null, Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
