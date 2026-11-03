package fr.tikigaming.games.mastermind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MastermindServiceTest {
    private static final List<MastermindColor> GUESS =
            List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, MastermindColor.YELLOW);

    @Test
    void createsAndLoadsGame() {
        MastermindService service = new MastermindService();

        MastermindGameSnapshot created = service.create();

        assertThat(service.get(created.id())).isEqualTo(created);
    }

    @Test
    void delegatesGuessAndRestartToGame() {
        MastermindService service = new MastermindService();
        UUID id = service.create().id();

        assertThat(service.guess(id, GUESS).attemptsUsed()).isEqualTo(1);
        assertThat(service.restart(id).attemptsUsed()).isZero();
    }

    @Test
    void rejectsUnknownGame() {
        MastermindService service = new MastermindService();

        assertThatThrownBy(() -> service.get(UUID.randomUUID())).isInstanceOf(MastermindNotFoundException.class);
    }
}
