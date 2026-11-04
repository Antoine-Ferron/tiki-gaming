package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

class RoomChannelInterceptorTest {

    private static final String SLUG = "bataille-navale";

    private final GameRoomService rooms = new GameRoomService();
    private final RoomChannelInterceptor interceptor = new RoomChannelInterceptor(rooms);
    private final MessageChannel channel = mock(MessageChannel.class);

    @Test
    void allowsSendToAnApplicationDestination() {
        Message<?> message = stompMessage(StompCommand.SEND, "/app/rooms/" + SLUG + "/create", "creator");

        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    }

    @Test
    void blocksSendOutsideTheApplicationPrefix() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        Message<?> message = stompMessage(StompCommand.SEND, "/topic/rooms/" + SLUG + "/" + code, "creator");

        assertThat(interceptor.preSend(message, channel)).isNull();
    }

    @Test
    void blocksSendWithoutADestination() {
        Message<?> message = stompMessage(StompCommand.SEND, null, "creator");

        assertThat(interceptor.preSend(message, channel)).isNull();
    }

    @Test
    void allowsASeatedAccountToSubscribeToItsRoomTopic() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        Message<?> message = stompMessage(StompCommand.SUBSCRIBE, "/topic/rooms/" + SLUG + "/" + code, "creator");

        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    }

    @Test
    void blocksAnAccountNotSeatedInTheRoomFromSubscribingToItsTopic() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        Message<?> message = stompMessage(StompCommand.SUBSCRIBE, "/topic/rooms/" + SLUG + "/" + code, "stranger");

        assertThat(interceptor.preSend(message, channel)).isNull();
    }

    @Test
    void blocksSubscribingToAnUnknownRoomCode() {
        Message<?> message = stompMessage(StompCommand.SUBSCRIBE, "/topic/rooms/" + SLUG + "/UNKNOWN", "someone");

        assertThat(interceptor.preSend(message, channel)).isNull();
    }

    @Test
    void blocksSubscribingWithoutAnAuthenticatedAccount() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        Message<?> message = stompMessage(StompCommand.SUBSCRIBE, "/topic/rooms/" + SLUG + "/" + code, null);

        assertThat(interceptor.preSend(message, channel)).isNull();
    }

    @Test
    void blocksEveryDestinationThatIsNotExplicitlyAllowed() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        for (String destination : new String[] {
            "/topic/rooms/**",
            "/topic/rooms/" + SLUG + "/*",
            "/topic/rooms/" + SLUG,
            "/topic/rooms/" + SLUG + "/" + code + "/extra",
            "/topic/**",
            "/topic/{a}/{b}/{c}",
            "/topic/rooms/{s}/{c}",
            "/topic/{x}/**",
            "/topic/other",
            "/queue/anything",
            "/user/queue/rooms/" + SLUG + "/other",
            "/user/queue/rooms/{s}/response"
        }) {
            Message<?> message = stompMessage(StompCommand.SUBSCRIBE, destination, "creator");

            assertThat(interceptor.preSend(message, channel)).as(destination).isNull();
        }
    }

    @Test
    void leavesSubscriptionsOutsideTheRoomTopicPatternUntouched() {
        Message<?> message = stompMessage(StompCommand.SUBSCRIBE, "/user/queue/rooms/" + SLUG + "/response", "someone");

        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    }

    @Test
    void leavesOtherStompCommandsUntouched() {
        Message<?> message = stompMessage(StompCommand.DISCONNECT, null, "someone");

        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    }

    private static Message<?> stompMessage(StompCommand command, String destination, String accountId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (destination != null) accessor.setDestination(destination);
        if (accountId != null) accessor.setUser(new AccountPrincipal(accountId));
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
