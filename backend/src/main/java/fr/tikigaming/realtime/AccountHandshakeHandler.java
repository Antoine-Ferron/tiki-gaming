package fr.tikigaming.realtime;

import java.security.Principal;
import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

/**
 * Identifie une connexion WebSocket par le compte placé en attribut par {@link SessionHandshakeInterceptor}, pour que
 * les destinations {@code /user/...} (réponses et erreurs privées) résolvent le bon compte.
 */
@Component
public class AccountHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(
            ServerHttpRequest request, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        Object accountId = attributes.get(SessionHandshakeInterceptor.ACCOUNT_ID_ATTRIBUTE);
        return accountId instanceof String id
                ? new AccountPrincipal(id)
                : super.determineUser(request, wsHandler, attributes);
    }
}
