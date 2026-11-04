package fr.tikigaming.realtime;

import java.util.Set;

/** Types d'évènement réservés au socle : un jeu ne peut pas relayer une action portant un de ces noms. */
public final class RoomEventTypes {

    public static final String ROOM_UPDATED = "ROOM_UPDATED";
    public static final String PLAYER_LEFT = "PLAYER_LEFT";

    private static final Set<String> RESERVED = Set.of(ROOM_UPDATED, PLAYER_LEFT);

    private RoomEventTypes() {}

    public static boolean isReserved(String type) {
        return RESERVED.contains(type);
    }
}
