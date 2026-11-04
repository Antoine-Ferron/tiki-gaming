package fr.tikigaming.realtime;

import java.security.Principal;
import java.time.Instant;
import java.util.function.BiFunction;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Point d'entrée STOMP générique, partagé par tous les jeux multijoueurs : créer/rejoindre/quitter une salle, et
 * relayer une action de jeu publique à tous les joueurs assis. Un jeu avec de l'état caché par joueur écrit son
 * propre {@code @MessageMapping} dans son package, au-dessus de {@link GameRoomService}/{@link IdempotencyGuard}.
 */
@Controller
public class GameSocketController {

    private final GameRoomService rooms;
    private final IdempotencyGuard idempotency;
    private final SimpMessagingTemplate messaging;

    public GameSocketController(GameRoomService rooms, IdempotencyGuard idempotency, SimpMessagingTemplate messaging) {
        this.rooms = rooms;
        this.idempotency = idempotency;
        this.messaging = messaging;
    }

    @MessageMapping("/rooms/{slug}/create")
    public void create(@DestinationVariable String slug, CreateRoomRequest request, Principal principal) {
        handle(slug, principal, (s, accountId) -> rooms.createRoom(s, accountId, request.maxPlayers()));
    }

    @MessageMapping("/rooms/{slug}/join")
    public void join(@DestinationVariable String slug, JoinRoomRequest request, Principal principal) {
        handle(slug, principal, (s, accountId) -> rooms.joinRoom(s, request.code(), accountId));
    }

    /** Crée ou rejoint une salle : même réponse au demandeur et même diffusion dans les deux cas. */
    private void handle(String slug, Principal principal, BiFunction<String, String, RoomView> action) {
        try {
            RoomView view = action.apply(slug, principal.getName());
            respond(slug, principal, view);
            broadcastRoomUpdated(slug, view);
        } catch (GameRoomException e) {
            sendError(slug, principal, e);
        }
    }

    @MessageMapping("/rooms/{slug}/leave")
    public void leave(@DestinationVariable String slug, JoinRoomRequest request, Principal principal) {
        rooms.leaveRoom(slug, request.code(), principal.getName())
                .ifPresent(code -> messaging.convertAndSend(
                        topic(slug, code), new RoomEvent<Void>(RoomEventTypes.PLAYER_LEFT, null, code, Instant.now())));
    }

    @MessageMapping("/rooms/{slug}/{code}/actions")
    public void relayAction(
            @DestinationVariable String slug,
            @DestinationVariable String code,
            RoomAction action,
            Principal principal) {
        if (RoomEventTypes.isReserved(action.type())) {
            sendError(
                    slug,
                    principal,
                    new GameRoomException(HttpStatus.BAD_REQUEST, "« " + action.type() + " » est réservé au socle."));
            return;
        }
        RoomView membership;
        try {
            membership = rooms.requireMembership(slug, code, principal.getName());
        } catch (GameRoomException e) {
            sendError(slug, principal, e);
            return;
        }
        if (idempotency.isFirst(slug + ":" + membership.code(), action.actionId())) {
            messaging.convertAndSend(
                    topic(slug, membership.code()),
                    new RoomEvent<>(action.type(), action.data(), membership.code(), Instant.now()));
        }
    }

    private void respond(String slug, Principal principal, RoomView view) {
        messaging.convertAndSendToUser(principal.getName(), "/queue/rooms/" + slug + "/response", view);
    }

    private void broadcastRoomUpdated(String slug, RoomView view) {
        messaging.convertAndSend(
                topic(slug, view.code()),
                new RoomEvent<>(RoomEventTypes.ROOM_UPDATED, view, view.code(), Instant.now()));
    }

    private void sendError(String slug, Principal principal, GameRoomException e) {
        messaging.convertAndSendToUser(
                principal.getName(),
                "/queue/rooms/" + slug + "/errors",
                new RoomErrorMessage(e.status().value(), e.getMessage()));
    }

    private static String topic(String slug, String code) {
        return "/topic/rooms/" + slug + "/" + code;
    }
}
