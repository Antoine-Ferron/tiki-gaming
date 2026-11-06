package fr.tikigaming.games.dame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Position;
import fr.tikigaming.games.dame.persistence.MatchStorageException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import tools.jackson.databind.json.JsonMapper;

class DameRecoveryTest {
    private final ApiMatches repository = new ApiMatches();
    private final JsonMapper json = JsonMapper.builder().build();
    private final DameApplicationService service = service();

    private DameApplicationService service() {
        return new DameApplicationService(repository, Clock.systemUTC(), UUID::randomUUID, json);
    }

    @Test
    void aFreshServerAndSessionRecoverTheBoardWithOnlyThePrivateBrowserToken() {
        MockHttpSession session = new MockHttpSession();
        var created = service.start(session, "Chérif", "Amadou");
        var played = service.play(session, created.id(), 0, new Move(new Position(6, 1), List.of(new Position(5, 0))));
        Object token = session.getAttribute("dame.owner");
        assertThat(token).isNotNull();
        MockHttpSession afterRestart = new MockHttpSession();
        afterRestart.setAttribute("dame.owner", token);
        assertThat(service().read(afterRestart, created.id())).isEqualTo(played);
    }

    @Test
    void anOrdinaryMoveIsNotAcknowledgedWhenItsDurableSaveFails() {
        MockHttpSession session = new MockHttpSession();
        var created = service.start(session, "Chérif", "Amadou");
        repository.failBeforeWrite = true;
        assertThatThrownBy(() -> service.play(
                        session, created.id(), 0, new Move(new Position(6, 1), List.of(new Position(5, 0)))))
                .isInstanceOf(MatchStorageException.class);
        assertThat(service.read(session, created.id())).isEqualTo(created);
    }
}
