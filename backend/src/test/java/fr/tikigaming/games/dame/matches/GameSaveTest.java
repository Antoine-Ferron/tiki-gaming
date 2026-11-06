package fr.tikigaming.games.dame.matches;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class GameSaveTest {
    private final Match match = Match.start(UUID.randomUUID(), "A", "B", Instant.EPOCH);

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"secret", "a", "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"})
    void rejectsInvalidOwnerHashes(String hash) {
        assertThatThrownBy(() -> new GameSave(match, hash, 0, "{}"))
                .isInstanceOfAny(NullPointerException.class, IllegalArgumentException.class);
    }

    @Test
    void rejectsNegativeVersionAndMissingState() {
        assertThatThrownBy(() -> new GameSave(match, "a".repeat(64), -1, "{}"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GameSave(match, "a".repeat(64), 0, " "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
