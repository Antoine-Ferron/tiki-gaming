package fr.tikigaming.games.bang.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.auth.AuthException;
import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.engine.PrivateTableService;
import fr.tikigaming.games.bang.model.GameStarted;
import fr.tikigaming.games.bang.model.TableSeat;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class PrivateTableControllerTest {

    private final PrivateTableService tables = mock(PrivateTableService.class);
    private final PrivateTableController controller = new PrivateTableController(tables);

    @Test
    void acceptingPassesTheSessionActorAndTheShotIdWithoutADodgeCard() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("target", "joueur@example.com"));

        assertThat(controller.accept("CODE", "shot", request).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(tables).respond("CODE", "target", "shot", null);
    }

    @Test
    void dodgingPassesTheSessionActorAndTheShotIdToTheTables() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("target", "joueur@example.com"));

        assertThat(controller.dodge("CODE", "shot", "missed", request).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(tables).respond("CODE", "target", "shot", "missed");
    }

    @Test
    void firingPassesOnlyTheSessionActorAndTheChosenCardAndTarget() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("shooter", "joueur@example.com"));
        request.addParameter("accountId", "someone-else");

        assertThat(controller.fire("CODE", "bang-1", "2", request).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(tables).fire("CODE", "shooter", "bang-1", 2);
    }

    @Test
    void creationPassesTheConnectedAccountIdToTheTables() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("account-id", "joueur@example.com"));
        TableSeat seat = new TableSeat("A1B2C3D4E5F6", 1, 1);
        when(tables.create("account-id")).thenReturn(seat);

        ResponseEntity<TableSeat> response = controller.create(request);

        verify(tables).create("account-id");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(seat);
    }

    @Test
    void joiningPassesTheCodeAndTheConnectedAccountIdToTheTables() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("second-account", "autre@example.com"));
        TableSeat seat = new TableSeat("A1B2C3D4E5F6", 2, 2);
        when(tables.join("A1B2C3D4E5F6", "second-account")).thenReturn(seat);

        TableSeat response = controller.join("A1B2C3D4E5F6", request);

        verify(tables).join("A1B2C3D4E5F6", "second-account");
        assertThat(response).isEqualTo(seat);
    }

    @Test
    void startingPassesTheCodeAndTheConnectedAccountIdToTheTables() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("third-account", "joueur@example.com"));
        when(tables.start("A1B2C3D4E5F6", "third-account")).thenReturn(new GameStarted("A1B2C3D4E5F6", 3));

        GameStarted response = controller.start("A1B2C3D4E5F6", request);

        verify(tables).start("A1B2C3D4E5F6", "third-account");
        assertThat(response).isEqualTo(new GameStarted("A1B2C3D4E5F6", 3));
    }

    @Test
    void anAnonymousStartNeverReachesTheTables() {
        assertThatThrownBy(() -> controller.start("UNKNOWN", new MockHttpServletRequest()))
                .isInstanceOfSatisfying(
                        AuthException.class, error -> assertThat(error.status()).isEqualTo(401));
        verifyNoInteractions(tables);
    }

    @Test
    void anAnonymousReadNeverReachesTheTables() {
        assertThatThrownBy(() -> controller.state("UNKNOWN", new MockHttpServletRequest()))
                .isInstanceOfSatisfying(
                        AuthException.class, error -> assertThat(error.status()).isEqualTo(401));
        verifyNoInteractions(tables);
    }

    @Test
    void readingPassesTheCodeAndConnectedAccountToTheTables() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser("account-id", "joueur@example.com"));

        controller.state("ABC123", request);

        verify(tables).state("ABC123", "account-id");
    }

    @Test
    void aGuestCreatesWithAServerIdentityAndReusesItWithoutBecomingAnAccount() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        String oldSession = request.getSession().getId();
        controller.create(request);
        ArgumentCaptor<String> identity = ArgumentCaptor.forClass(String.class);
        verify(tables).create(identity.capture());
        assertThat(identity.getValue()).startsWith("guest:");
        assertThat(request.getSession().getId()).isNotEqualTo(oldSession);
        assertThat(AuthSession.currentUser(request)).isNull();

        MockHttpServletRequest resumed = new MockHttpServletRequest();
        resumed.setSession(request.getSession());
        resumed.addParameter("accountId", "someone-else");
        controller.join("CODE", resumed);
        verify(tables).join("CODE", identity.getValue());
    }

    @Test
    void signingInAfterAGuestUsesTheAccountIdentity() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        controller.join("CODE", request);
        AuthSession.signIn(request, new AuthUser("account", "bang@example.test"));
        controller.join("CODE", request);
        verify(tables).join("CODE", "account");
    }
}
