package fr.tikigaming.games.bang;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PrivateTableServiceTest {

    private final PrivateTableService tables = new PrivateTableService();

    @Test
    void createsATableWithAShareableCodeAndTheCreatorsSeat() {
        TableSeat created = tables.create("creator");

        assertThat(created).isNotNull();
        assertThat(created.code()).isNotBlank();
        assertThat(created.seat()).isEqualTo(1);
        assertThat(created.playerCount()).isEqualTo(1);
    }

    @Test
    void threeDistinctAccountsTakeTheRemainingSeats() {
        String code = tables.create("creator").code();

        for (int seat = 2; seat <= 4; seat++) {
            assertThat(tables.join(code, "player-" + seat)).isEqualTo(new TableSeat(code, seat, seat));
        }
    }

    @Test
    void refusesAnUnknownTableCode() {
        assertThatThrownBy(() -> tables.join("UNKNOWN", "player"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
