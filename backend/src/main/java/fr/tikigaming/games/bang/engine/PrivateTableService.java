package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameStarted;
import fr.tikigaming.games.bang.model.GameState;
import fr.tikigaming.games.bang.model.PlayerGameView;
import fr.tikigaming.games.bang.model.TableSeat;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Tables privées en mémoire. Sans création, jonction ou démarrage accepté pendant {@link #INACTIVITY_TIMEOUT}, la
 * table et sa donne sont retirées : sa place se libère, et son créateur peut ouvrir une nouvelle table.
 */
@Service
public class PrivateTableService {

    static final int MAX_TABLES = 1000;
    static final Duration INACTIVITY_TIMEOUT = Duration.ofHours(1);

    private final Map<String, Table> tables = new HashMap<>();
    private final InitialDeal initialDeal;
    private final Clock clock;

    @Autowired
    public PrivateTableService(InitialDeal initialDeal) {
        this(initialDeal, Clock.systemUTC());
    }

    PrivateTableService(InitialDeal initialDeal, Clock clock) {
        this.initialDeal = initialDeal;
        this.clock = clock;
    }

    public synchronized TableSeat create(String accountId) {
        purgeInactive();
        if (tables.values().stream().anyMatch(table -> table.players.getFirst().equals(accountId))) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "Tu as déjà une table privée ouverte.");
        }
        if (tables.size() >= MAX_TABLES) {
            throw new PrivateTableException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Le serveur a atteint sa limite de tables privées.");
        }
        String code;
        do {
            code = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 12)
                    .toUpperCase(Locale.ROOT);
        } while (tables.containsKey(code));
        tables.put(code, new Table(accountId, clock.instant()));
        return new TableSeat(code, 1, 1);
    }

    public synchronized TableSeat join(String code, String accountId) {
        purgeInactive();
        if (code != null) {
            code = code.trim().toUpperCase(Locale.ROOT);
        }
        Table table = tables.get(code);
        if (table == null) throw new PrivateTableException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        List<String> players = table.players;
        int existingSeat = players.indexOf(accountId);
        if (existingSeat < 0 && players.size() >= 4) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "Cette table est pleine.");
        }
        table.lastActivity = clock.instant();
        if (existingSeat >= 0) return new TableSeat(code, existingSeat + 1, players.size());
        players.add(accountId);
        return new TableSeat(code, players.size(), players.size());
    }

    public synchronized GameStarted start(String code, String accountId) {
        purgeInactive();
        code = code == null ? null : code.trim().toUpperCase(Locale.ROOT);
        Table table = tables.get(code);
        if (table == null) throw new PrivateTableException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        List<String> players = table.players;
        if (!players.contains(accountId)) {
            throw new PrivateTableException(
                    HttpStatus.FORBIDDEN, "Tu dois être assis à cette table pour démarrer la partie.");
        }
        if (players.size() < 4) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "Il faut quatre joueurs pour démarrer la partie.");
        }
        if (table.game == null) table.game = initialDeal.deal(List.copyOf(players));
        table.lastActivity = clock.instant();
        return new GameStarted(code, table.game.currentSeat());
    }

    public synchronized PlayerGameView state(String code, String accountId) {
        purgeInactive();
        code = code == null ? null : code.trim().toUpperCase(Locale.ROOT);
        Table table = tables.get(code);
        if (table == null) throw new PrivateTableException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        if (!table.players.contains(accountId)) {
            throw new PrivateTableException(
                    HttpStatus.FORBIDDEN, "Tu dois être assis à cette table pour consulter la partie.");
        }
        if (table.game == null) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "La partie n'a pas encore démarré.");
        }
        GameState game = table.game;
        GameState.Player own = game.players().stream()
                .filter(player -> player.accountId().equals(accountId))
                .findFirst()
                .orElseThrow();
        return new PlayerGameView(
                code,
                own.seat(),
                game.currentSeat(),
                game.phase(),
                own.roleCard().role(),
                own.hand().stream()
                        .map(card -> new PlayerGameView.Card(card.id(), card.type()))
                        .toList(),
                game.players().stream()
                        .map(player -> new PlayerGameView.Player(
                                player.seat(),
                                player.character(),
                                player.health(),
                                player.maxHealth(),
                                List.of(),
                                player.hand().size(),
                                player.roleCard().role() == Role.SHERIFF ? Role.SHERIFF : null))
                        .toList());
    }

    public synchronized void draw(String code, String accountId) {
        Table table = activeTable(code, accountId);
        GameState game = table.game;
        if (game.phase() != GameState.Phase.DRAW) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "Ce n'est pas la phase de pioche.");
        }
        // shortcut: la défausse n'est pas recyclée ; à ajouter avec les règles de recyclage.
        if (game.drawPile().size() < 2) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "Il reste moins de deux cartes dans la pioche.");
        }
        List<GameState.Player> players = game.players().stream()
                .map(player -> {
                    if (player.seat() != game.currentSeat()) return player;
                    List<CardInstance> hand = new ArrayList<>(player.hand());
                    hand.addAll(game.drawPile().subList(0, 2));
                    return new GameState.Player(
                            player.accountId(),
                            player.seat(),
                            player.roleCard(),
                            player.character(),
                            player.health(),
                            player.maxHealth(),
                            List.copyOf(hand));
                })
                .toList();
        table.game = new GameState(
                players,
                List.copyOf(game.drawPile().subList(2, game.drawPile().size())),
                game.currentSeat(),
                GameState.Phase.PLAY);
        table.lastActivity = clock.instant();
    }

    private Table activeTable(String code, String accountId) {
        purgeInactive();
        code = code == null ? null : code.trim().toUpperCase(Locale.ROOT);
        Table table = tables.get(code);
        if (table == null) throw new PrivateTableException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        if (!table.players.contains(accountId)) {
            throw new PrivateTableException(HttpStatus.FORBIDDEN, "Tu dois être assis à cette table.");
        }
        if (table.game == null) {
            throw new PrivateTableException(HttpStatus.CONFLICT, "La partie n'a pas encore démarré.");
        }
        if (!table.players.get(table.game.currentSeat() - 1).equals(accountId)) {
            throw new PrivateTableException(HttpStatus.FORBIDDEN, "Ce n'est pas ton tour.");
        }
        return table;
    }

    synchronized GameState game(String code) {
        purgeInactive();
        Table table = tables.get(code);
        return table == null ? null : table.game;
    }

    private void purgeInactive() {
        Instant cutoff = clock.instant().minus(INACTIVITY_TIMEOUT);
        tables.values().removeIf(table -> !table.lastActivity.isAfter(cutoff));
    }

    private static final class Table {
        private final List<String> players = new ArrayList<>();
        private Instant lastActivity;
        private GameState game;

        private Table(String creator, Instant now) {
            players.add(creator);
            lastActivity = now;
        }
    }
}
