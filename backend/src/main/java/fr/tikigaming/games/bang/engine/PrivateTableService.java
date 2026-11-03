package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.TableSeat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PrivateTableService {

    private final Map<String, List<String>> tables = new HashMap<>();

    public synchronized TableSeat create(String accountId) {
        String code;
        do {
            code = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 12)
                    .toUpperCase(Locale.ROOT);
        } while (tables.containsKey(code));
        tables.put(code, new ArrayList<>(List.of(accountId)));
        return new TableSeat(code, 1, 1);
    }

    public synchronized TableSeat join(String code, String accountId) {
        List<String> players = tables.get(code);
        if (players == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        int existingSeat = players.indexOf(accountId);
        if (existingSeat >= 0) return new TableSeat(code, existingSeat + 1, players.size());
        if (players.size() >= 4) throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette table est pleine.");
        players.add(accountId);
        return new TableSeat(code, players.size(), players.size());
    }

    public synchronized void start(String code, String accountId) {
        List<String> players = tables.get(code);
        if (players == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        if (!players.contains(accountId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Tu dois être assis à cette table pour démarrer la partie.");
        }
        if (players.size() < 4) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Il faut quatre joueurs pour démarrer la partie.");
        }
    }
}
