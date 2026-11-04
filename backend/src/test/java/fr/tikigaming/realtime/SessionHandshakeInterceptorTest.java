package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.socket.WebSocketHandler;

class SessionHandshakeInterceptorTest {

    private final SessionHandshakeInterceptor interceptor = new SessionHandshakeInterceptor();
    private final WebSocketHandler handler = mock(WebSocketHandler.class);

    @Test
    void refusesAHandshakeWithoutAnHttpSession() {
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        MockHttpServletResponse httpResponse = new MockHttpServletResponse();
        Map<String, Object> attributes = new HashMap<>();

        boolean accepted = interceptor.beforeHandshake(
                new ServletServerHttpRequest(httpRequest),
                new ServletServerHttpResponse(httpResponse),
                handler,
                attributes);

        assertThat(accepted).isFalse();
        assertThat(httpResponse.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(attributes).isEmpty();
    }

    @Test
    void acceptsAHandshakeWithAConnectedAccountAndExposesItsId() {
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        AuthSession.signIn(httpRequest, new AuthUser("account-1", "player@example.com"));
        Map<String, Object> attributes = new HashMap<>();

        boolean accepted = interceptor.beforeHandshake(
                new ServletServerHttpRequest(httpRequest),
                new ServletServerHttpResponse(new MockHttpServletResponse()),
                handler,
                attributes);

        assertThat(accepted).isTrue();
        assertThat(attributes).containsEntry(SessionHandshakeInterceptor.ACCOUNT_ID_ATTRIBUTE, "account-1");
    }
}
