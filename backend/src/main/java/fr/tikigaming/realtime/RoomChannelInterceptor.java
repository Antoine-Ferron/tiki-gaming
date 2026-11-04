package fr.tikigaming.realtime;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;

/**
 * Garde-fou des frames STOMP reçues des clients, que le broker simple ne contrôle pas lui-même : sans lui, un
 * {@code SEND} direct vers {@code /topic/...} serait diffusé tel quel aux abonnés (contournant l'appartenance à la
 * salle, l'idempotence et les types réservés du {@link GameSocketController}), et n'importe quel compte connecté
 * pourrait s'abonner au topic d'une salle dont il connaît le code. Une frame refusée est ignorée en silence.
 */
class RoomChannelInterceptor implements ChannelInterceptor {

    private static final String ROOM_TOPIC_PREFIX = "/topic/rooms/";
    private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/rooms/([^/]+)/([^/]+)$");

    private final GameRoomService rooms;

    RoomChannelInterceptor(GameRoomService rooms) {
        this.rooms = rooms;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();
        if (StompCommand.SEND.equals(command)) {
            return isApplicationDestination(accessor.getDestination()) ? message : null;
        }
        if (StompCommand.SUBSCRIBE.equals(command)) {
            return maySubscribe(accessor.getDestination(), accessor.getUser()) ? message : null;
        }
        return message;
    }

    private static boolean isApplicationDestination(String destination) {
        return destination != null && destination.startsWith(WebSocketConfig.APPLICATION_PREFIX + "/");
    }

    private boolean maySubscribe(String destination, Principal user) {
        if (destination == null) return false;
        // Le broker simple interprète les motifs Ant : « /topic/rooms/** » s'abonnerait à toutes les salles.
        if (destination.indexOf('*') >= 0 || destination.indexOf('?') >= 0) return false;
        if (!destination.startsWith(ROOM_TOPIC_PREFIX)) return true;
        Matcher matcher = ROOM_TOPIC.matcher(destination);
        if (!matcher.matches() || user == null) return false;
        try {
            rooms.requireMembership(matcher.group(1), matcher.group(2), user.getName());
            return true;
        } catch (GameRoomException e) {
            return false;
        }
    }
}
