package fr.tikigaming.realtime;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Authentifie la connexion WebSocket avec la session HTTP existante (cookie {@code JSESSIONID}, même origine) :
 * aucun nouveau mécanisme d'authentification, celui de {@link AuthSession} est réutilisé tel quel. Une connexion
 * sans compte connecté est refusée au handshake (401), avant toute négociation WebSocket.
 */
@Component
public class SessionHandshakeInterceptor implements HandshakeInterceptor {

    static final String ACCOUNT_ID_ATTRIBUTE = "accountId";

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }
        AuthUser user = AuthSession.currentUser(servletRequest.getServletRequest());
        if (user == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put(ACCOUNT_ID_ATTRIBUTE, user.id());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // Rien à faire : l'identité du compte est déjà portée par les attributs de session WebSocket.
    }
}
