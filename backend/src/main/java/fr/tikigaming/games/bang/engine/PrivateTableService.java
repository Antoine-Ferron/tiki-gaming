package fr.tikigaming.games.bang.engine;

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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Tables privées en mémoire. Une table sans création ni jonction pendant {@link #INACTIVITY_TIMEOUT} est retirée : sa
 * place se libère, et son créateur peut ouvrir une nouvelle table.
 */
@Service
public class PrivateTableService {

    static final int MAX_TABLES = 1000;
    static final Duration INACTIVITY_TIMEOUT = Duration.ofHours(1);

    private final Map<String, Table> tables = new HashMap<>();
    private final Clock clock;

    public PrivateTableService() {
        this(Clock.systemUTC());
    }

    PrivateTableService(Clock clock) {
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

    private void purgeInactive() {
        Instant cutoff = clock.instant().minus(INACTIVITY_TIMEOUT);
        tables.values().removeIf(table -> !table.lastActivity.isAfter(cutoff));
    }

    private static final class Table {
        private final List<String> players = new ArrayList<>();
        private Instant lastActivity;

        private Table(String creator, Instant now) {
            players.add(creator);
            lastActivity = now;
        }
    }
}
