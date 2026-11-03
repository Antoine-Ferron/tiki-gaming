package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.bang.model.TableSeat;
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

    @Test
    void refusesAFifthAccountAtAFullTable() {
        String code = tables.create("creator").code();
        for (int seat = 2; seat <= 4; seat++) {
            tables.join(code, "player-" + seat);
        }

        assertThatThrownBy(() -> tables.join(code, "fifth-account"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void theSameAccountKeepsItsSeatWithoutConsumingAnotherPlace() {
        String code = tables.create("creator").code();
        TableSeat second = tables.join(code, "second");

        assertThat(tables.join(code, "second")).isEqualTo(second);
        assertThat(tables.join(code, "creator")).isEqualTo(new TableSeat(code, 1, 2));
        assertThat(tables.join(code, "third")).isEqualTo(new TableSeat(code, 3, 3));
        assertThat(tables.join(code, "fourth")).isEqualTo(new TableSeat(code, 4, 4));
        assertThat(tables.join(code, "second")).isEqualTo(new TableSeat(code, 2, 4));
    }
}
