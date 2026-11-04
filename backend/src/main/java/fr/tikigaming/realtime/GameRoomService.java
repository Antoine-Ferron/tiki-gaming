package fr.tikigaming.realtime;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Salles de jeu en mémoire, partagées par tous les jeux (généralise {@code PrivateTableService} de BANG!, dont les
 * tables restent à 4 places fixes et à usage interne). Une salle sans création ni jonction pendant
 * {@link #INACTIVITY_TIMEOUT} est retirée : sa place se libère, et son créateur peut en ouvrir une nouvelle.
 */
@Service
public class GameRoomService {

    static final int MAX_ROOMS = 1000;
    static final int MAX_PLAYERS = 16;
    static final Duration INACTIVITY_TIMEOUT = Duration.ofHours(1);

    private final Map<String, Room> rooms = new HashMap<>();
    // Index inverse du premier siège de chaque salle (gameSlug+compte -> code), pour vérifier en O(1) qu'un compte
    // n'a pas déjà une salle ouverte, au lieu de parcourir toutes les salles de tous les jeux à chaque création.
    private final Map<String, String> openRoomByFirstSeat = new HashMap<>();
    private final Clock clock;

    @Autowired
    public GameRoomService() {
        this(Clock.systemUTC());
    }

    GameRoomService(Clock clock) {
        this.clock = clock;
    }

    public synchronized RoomView createRoom(String gameSlug, String accountId, int maxPlayers) {
        if (maxPlayers < 1 || maxPlayers > MAX_PLAYERS) {
            throw new GameRoomException(
                    HttpStatus.BAD_REQUEST, "Le nombre de joueurs doit être compris entre 1 et " + MAX_PLAYERS + ".");
        }
        purgeInactive();
        String firstSeatKey = firstSeatKey(gameSlug, accountId);
        if (openRoomByFirstSeat.containsKey(firstSeatKey)) {
            throw new GameRoomException(HttpStatus.CONFLICT, "Tu as déjà une salle ouverte pour ce jeu.");
        }
        if (rooms.size() >= MAX_ROOMS) {
            throw new GameRoomException(HttpStatus.SERVICE_UNAVAILABLE, "Le serveur a atteint sa limite de salles.");
        }
        String code;
        do {
            code = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 12)
                    .toUpperCase(Locale.ROOT);
        } while (rooms.containsKey(code));
        rooms.put(code, new Room(gameSlug, accountId, maxPlayers, clock.instant()));
        openRoomByFirstSeat.put(firstSeatKey, code);
        return new RoomView(gameSlug, code, 1, 1, maxPlayers);
    }

    public synchronized RoomView joinRoom(String gameSlug, String code, String accountId) {
        purgeInactive();
        String normalized = normalize(code);
        Room room = findRoom(gameSlug, normalized);
        if (room == null) throw new GameRoomException(HttpStatus.NOT_FOUND, "Code de salle inconnu.");
        List<String> players = room.players;
        int existingSeat = players.indexOf(accountId);
        if (existingSeat < 0 && players.size() >= room.maxPlayers) {
            throw new GameRoomException(HttpStatus.CONFLICT, "Cette salle est pleine.");
        }
        room.lastActivity = clock.instant();
        if (existingSeat >= 0) return view(gameSlug, normalized, room, existingSeat + 1);
        players.add(accountId);
        return view(gameSlug, normalized, room, players.size());
    }

    /**
     * Retire le compte de la salle et renvoie son nouvel état (sans lui, pour les joueurs restants) s'il en a bien
     * été retiré, sinon vide sans rien changer. Pas de siège dans la réponse : un départ décale les places des
     * joueurs suivants (liste), donc le seul siège que connaît encore ce compte (le sien) ne veut plus rien dire.
     */
    public synchronized Optional<RoomSummary> leaveRoom(String gameSlug, String code, String accountId) {
        Room room = findRoom(gameSlug, code);
        if (room == null) return Optional.empty();
        int seat = room.players.indexOf(accountId);
        if (seat < 0) return Optional.empty();
        room.players.remove(seat);
        String normalized = normalize(code);
        if (room.players.isEmpty()) {
            rooms.remove(normalized);
            openRoomByFirstSeat.remove(firstSeatKey(gameSlug, accountId));
            return Optional.of(new RoomSummary(gameSlug, normalized, 0, room.maxPlayers));
        }
        if (seat == 0) {
            openRoomByFirstSeat.remove(firstSeatKey(gameSlug, accountId));
            openRoomByFirstSeat.put(firstSeatKey(gameSlug, room.players.getFirst()), normalized);
        }
        return Optional.of(new RoomSummary(gameSlug, normalized, room.players.size(), room.maxPlayers));
    }

    /** Vérifie qu'un compte est bien assis dans cette salle, avant de lui laisser envoyer une action. */
    public synchronized RoomView requireMembership(String gameSlug, String code, String accountId) {
        Room room = findRoom(gameSlug, code);
        if (room == null) throw new GameRoomException(HttpStatus.NOT_FOUND, "Code de salle inconnu.");
        int seat = room.players.indexOf(accountId);
        if (seat < 0) throw new GameRoomException(HttpStatus.FORBIDDEN, "Tu n'es pas assis à cette salle.");
        return view(gameSlug, normalize(code), room, seat + 1);
    }

    public synchronized Optional<RoomView> findRoomOf(String gameSlug, String accountId) {
        for (Map.Entry<String, Room> entry : rooms.entrySet()) {
            Room room = entry.getValue();
            if (!room.gameSlug.equals(gameSlug)) continue;
            int seat = room.players.indexOf(accountId);
            if (seat >= 0) return Optional.of(view(gameSlug, entry.getKey(), room, seat + 1));
        }
        return Optional.empty();
    }

    private Room findRoom(String gameSlug, String code) {
        Room room = rooms.get(normalize(code));
        return room != null && room.gameSlug.equals(gameSlug) ? room : null;
    }

    private static String normalize(String code) {
        return code == null ? null : code.trim().toUpperCase(Locale.ROOT);
    }

    private static String firstSeatKey(String gameSlug, String accountId) {
        return gameSlug + '\u0000' + accountId;
    }

    private static RoomView view(String gameSlug, String code, Room room, int seat) {
        return new RoomView(gameSlug, code, seat, room.players.size(), room.maxPlayers);
    }

    private void purgeInactive() {
        Instant cutoff = clock.instant().minus(INACTIVITY_TIMEOUT);
        Iterator<Map.Entry<String, Room>> it = rooms.entrySet().iterator();
        while (it.hasNext()) {
            Room room = it.next().getValue();
            if (room.lastActivity.isAfter(cutoff)) continue;
            it.remove();
            if (!room.players.isEmpty()) {
                openRoomByFirstSeat.remove(firstSeatKey(room.gameSlug, room.players.getFirst()));
            }
        }
    }

    private static final class Room {
        private final String gameSlug;
        private final List<String> players = new ArrayList<>();
        private final int maxPlayers;
        private Instant lastActivity;

        private Room(String gameSlug, String creator, int maxPlayers, Instant now) {
            this.gameSlug = gameSlug;
            this.maxPlayers = maxPlayers;
            players.add(creator);
            lastActivity = now;
        }
    }
}
