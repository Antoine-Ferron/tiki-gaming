package fr.tikigaming.games.bang;

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

    public TableSeat join(String code, String accountId) {
        List<String> players = tables.get(code);
        if (players == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Code de table inconnu.");
        players.add(accountId);
        return new TableSeat(code, players.size(), players.size());
    }
}
