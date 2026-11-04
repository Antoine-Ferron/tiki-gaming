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

    private static final String SEGMENT = "[^/*?{}]+";
    private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/rooms/(" + SEGMENT + ")/(" + SEGMENT + ")$");
    private static final Pattern USER_QUEUE = Pattern.compile("^/user/queue/rooms/" + SEGMENT + "/(response|errors)$");

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

    /**
     * Liste d'autorisations : tout ce qui n'est pas explicitement permis est refusé. Le broker simple interprète
     * les motifs Ant ({@code *}, {@code ?}, {@code {a}}) : un abonnement à {@code /topic/{a}/{b}/{c}} recevrait les
     * évènements de toutes les salles, d'où des segments sans aucun de ces caractères. Un jeu qui ajoute ses propres
     * destinations les déclare ici.
     */
    private boolean maySubscribe(String destination, Principal user) {
        if (destination == null || user == null) return false;
        if (USER_QUEUE.matcher(destination).matches()) return true;
        Matcher room = ROOM_TOPIC.matcher(destination);
        if (!room.matches()) return false;
        try {
            rooms.requireMembership(room.group(1), room.group(2), user.getName());
            return true;
        } catch (GameRoomException e) {
            return false;
        }
    }
}
