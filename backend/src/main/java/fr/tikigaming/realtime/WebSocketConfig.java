package fr.tikigaming.realtime;

import fr.tikigaming.config.TikiProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Transport temps réel de la plateforme : un seul endpoint STOMP, partagé par tous les jeux multijoueurs. Un jeu
 * n'a jamais besoin de son propre endpoint : il distingue ses salles par {@code gameSlug} dans la destination (voir
 * {@link GameSocketController}).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    static final String ENDPOINT = "/ws";
    static final String APPLICATION_PREFIX = "/app";
    static final String USER_PREFIX = "/user";
    static final String[] BROKER_PREFIXES = {"/topic", "/queue"};

    private final SessionHandshakeInterceptor handshakeInterceptor;
    private final AccountHandshakeHandler handshakeHandler;
    private final TikiProperties properties;
    private final GameRoomService rooms;

    public WebSocketConfig(
            SessionHandshakeInterceptor handshakeInterceptor,
            AccountHandshakeHandler handshakeHandler,
            TikiProperties properties,
            GameRoomService rooms) {
        this.handshakeInterceptor = handshakeInterceptor;
        this.handshakeHandler = handshakeHandler;
        this.properties = properties;
        this.rooms = rooms;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(ENDPOINT)
                .addInterceptors(handshakeInterceptor)
                .setHandshakeHandler(handshakeHandler)
                .setAllowedOriginPatterns(properties.frontendUrl())
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker(BROKER_PREFIXES);
        registry.setApplicationDestinationPrefixes(APPLICATION_PREFIX);
        registry.setUserDestinationPrefix(USER_PREFIX);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new RoomChannelInterceptor(rooms));
    }
}
