package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;

class AccountHandshakeHandlerTest {

    private final AccountHandshakeHandler handler = new AccountHandshakeHandler();
    private final ServerHttpRequest request = mock(ServerHttpRequest.class);
    private final WebSocketHandler wsHandler = mock(WebSocketHandler.class);

    @Test
    void identifiesTheConnectionByTheAccountIdPlacedByTheHandshakeInterceptor() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(SessionHandshakeInterceptor.ACCOUNT_ID_ATTRIBUTE, "account-1");

        Principal principal = handler.determineUser(request, wsHandler, attributes);

        assertThat(principal).isEqualTo(new AccountPrincipal("account-1"));
    }

    @Test
    void hasNoIdentityWithoutAnAccountIdAttribute() {
        Principal principal = handler.determineUser(request, wsHandler, new HashMap<>());

        assertThat(principal).isNull();
    }
}
