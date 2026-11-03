package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.config.import=",
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
class GameSocketControllerIntegrationTest {

    private static final String SLUG = "integration-test-game";

    @LocalServerPort
    private int port;

    @Test
    void twoAccountsCreateAndJoinTheSameRoomAndSeeEachOthersPresence() throws Exception {
        StompSession sessionA = connect("alice");
        BlockingQueue<RoomView> responsesA = subscribeToResponses(sessionA);

        sessionA.send("/app/rooms/" + SLUG + "/create", new CreateRoomRequest(4));
        RoomView created = responsesA.poll(5, TimeUnit.SECONDS);
        assertThat(created).isNotNull();
        assertThat(created.seat()).isEqualTo(1);
        assertThat(created.playerCount()).isEqualTo(1);

        BlockingQueue<RoomEvent<?>> topicEventsA = subscribeToTopic(sessionA, created.code());

        StompSession sessionB = connect("bob");
        BlockingQueue<RoomView> responsesB = subscribeToResponses(sessionB);
        BlockingQueue<RoomEvent<?>> topicEventsB = subscribeToTopic(sessionB, created.code());

        sessionB.send("/app/rooms/" + SLUG + "/join", new JoinRoomRequest(created.code()));
        RoomView joined = responsesB.poll(5, TimeUnit.SECONDS);
        assertThat(joined).isNotNull();
        assertThat(joined.seat()).isEqualTo(2);
        assertThat(joined.playerCount()).isEqualTo(2);

        RoomEvent<?> seenByA = topicEventsA.poll(5, TimeUnit.SECONDS);
        assertThat(seenByA).isNotNull();
        assertThat(seenByA.type()).isEqualTo("ROOM_UPDATED");

        // Le joueur qui rejoint voit aussi la diffusion sur le topic de la salle, pas seulement sa propre réponse.
        RoomEvent<?> seenByB = topicEventsB.poll(5, TimeUnit.SECONDS);
        assertThat(seenByB).isNotNull();
        assertThat(seenByB.type()).isEqualTo("ROOM_UPDATED");

        sessionA.disconnect();
        sessionB.disconnect();
    }

    @Test
    void anUnknownRoomCodeIsRefusedWithAPrivateError() throws Exception {
        StompSession session = connect("solo-player");
        BlockingQueue<RoomErrorMessage> errors = new LinkedBlockingQueue<>();
        session.subscribe(
                "/user/queue/rooms/" + SLUG + "/errors", new JsonFrameHandler<>(RoomErrorMessage.class, errors));

        session.send("/app/rooms/" + SLUG + "/join", new JoinRoomRequest("UNKNOWN-CODE"));

        RoomErrorMessage error = errors.poll(5, TimeUnit.SECONDS);
        assertThat(error).isNotNull();
        assertThat(error.status()).isEqualTo(404);

        session.disconnect();
    }

    @Test
    void duplicateActionsAreBroadcastOnlyOnce() throws Exception {
        StompSession creatorSession = connect("action-creator");
        BlockingQueue<RoomView> responses = subscribeToResponses(creatorSession);
        creatorSession.send("/app/rooms/" + SLUG + "/create", new CreateRoomRequest(4));
        RoomView created = responses.poll(5, TimeUnit.SECONDS);
        assertThat(created).isNotNull();

        BlockingQueue<RoomEvent<?>> topicEvents = subscribeToTopic(creatorSession, created.code());
        topicEvents.poll(1, TimeUnit.SECONDS); // ignore l'éventuel ROOM_UPDATED de la création elle-même

        RoomAction action = new RoomAction("SHOT_FIRED", "action-42", Map.of("target", "bob"));
        String destination = "/app/rooms/" + SLUG + "/" + created.code() + "/actions";
        creatorSession.send(destination, action);
        creatorSession.send(destination, action);

        RoomEvent<?> first = topicEvents.poll(5, TimeUnit.SECONDS);
        assertThat(first).isNotNull();
        assertThat(first.type()).isEqualTo("SHOT_FIRED");
        assertThat(topicEvents.poll(1, TimeUnit.SECONDS)).isNull();

        creatorSession.disconnect();
    }

    private BlockingQueue<RoomView> subscribeToResponses(StompSession session) {
        BlockingQueue<RoomView> queue = new LinkedBlockingQueue<>();
        session.subscribe("/user/queue/rooms/" + SLUG + "/response", new JsonFrameHandler<>(RoomView.class, queue));
        return queue;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private BlockingQueue<RoomEvent<?>> subscribeToTopic(StompSession session, String code) {
        BlockingQueue<RoomEvent<?>> queue = new LinkedBlockingQueue<>();
        BlockingQueue rawQueue = queue;
        session.subscribe("/topic/rooms/" + SLUG + "/" + code, new JsonFrameHandler<>(RoomEvent.class, rawQueue));
        return queue;
    }

    private StompSession connect(String accountId) throws Exception {
        String jSessionId = signedInSessionCookie(accountId);
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new JacksonJsonMessageConverter());
        WebSocketHttpHeaders handshakeHeaders = new WebSocketHttpHeaders();
        handshakeHeaders.add(HttpHeaders.COOKIE, "JSESSIONID=" + jSessionId);
        return stompClient
                .connectAsync(
                        "ws://localhost:" + port + "/ws/websocket",
                        handshakeHeaders,
                        new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);
    }

    /** Ouvre une session anonyme, mint un jeton CSRF, puis authentifie le compte : renvoie le JSESSIONID final. */
    private String signedInSessionCookie(String accountId) {
        RestTemplate rest = new RestTemplate();
        String base = "http://localhost:" + port;

        ResponseEntity<String> anonymous = rest.getForEntity(base + "/api/auth/session", String.class);
        String csrfToken = cookieValue(anonymous, "XSRF-TOKEN");
        String anonymousSessionId = cookieValue(anonymous, "JSESSIONID");

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, "JSESSIONID=" + anonymousSessionId + "; XSRF-TOKEN=" + csrfToken);
        headers.add("X-XSRF-TOKEN", csrfToken);
        ResponseEntity<Void> loggedIn = rest.exchange(
                base + "/test/login/" + accountId, HttpMethod.POST, new HttpEntity<>(headers), Void.class);
        String signedInSessionId = cookieValue(loggedIn, "JSESSIONID");
        return signedInSessionId != null ? signedInSessionId : anonymousSessionId;
    }

    private static String cookieValue(ResponseEntity<?> response, String name) {
        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (cookies == null) return null;
        for (String cookie : cookies) {
            String prefix = name + "=";
            if (cookie.startsWith(prefix)) return cookie.substring(prefix.length(), cookie.indexOf(';'));
        }
        return null;
    }

    private static final class JsonFrameHandler<T> extends StompSessionHandlerAdapter {
        private final Class<T> type;
        private final BlockingQueue<T> queue;

        private JsonFrameHandler(Class<T> type, BlockingQueue<T> queue) {
            this.type = type;
            this.queue = queue;
        }

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return type;
        }

        @Override
        @SuppressWarnings("unchecked")
        public void handleFrame(StompHeaders headers, Object payload) {
            queue.add((T) payload);
        }
    }

    /**
     * Authentifie un compte sans passer par Google OAuth : réservé aux tests (non exposé en production). Un servlet
     * brut, plutôt qu'un {@code @RestController}, pour ne pas polluer le scan de composants des autres tests
     * {@code @SpringBootTest} du module, qui partagent le même classpath.
     */
    @TestConfiguration
    static class TestLoginConfig {
        @Bean
        ServletRegistrationBean<HttpServlet> testLoginServlet() {
            HttpServlet servlet = new HttpServlet() {
                @Override
                protected void doPost(HttpServletRequest request, HttpServletResponse response) {
                    String accountId = request.getRequestURI()
                            .substring(request.getRequestURI().lastIndexOf('/') + 1);
                    AuthSession.signIn(request, new AuthUser(accountId, accountId + "@example.com"));
                }
            };
            return new ServletRegistrationBean<>(servlet, "/test/login/*");
        }
    }
}
