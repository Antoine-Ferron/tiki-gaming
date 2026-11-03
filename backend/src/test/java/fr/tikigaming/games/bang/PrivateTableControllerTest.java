package fr.tikigaming.games.bang;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class PrivateTableControllerTest {

    private final PrivateTableService tables = mock(PrivateTableService.class);
    private final PrivateTableController controller = new PrivateTableController(tables);

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
}
