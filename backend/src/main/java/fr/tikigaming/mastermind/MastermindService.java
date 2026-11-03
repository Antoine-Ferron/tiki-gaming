package fr.tikigaming.mastermind;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Service;

@Service
public class MastermindService {
    private final Map<UUID, MastermindGame> games = new ConcurrentHashMap<>();
    private final RandomGenerator random = RandomGenerator.getDefault();

    public MastermindGameSnapshot create() {
        UUID id = UUID.randomUUID();
        MastermindGame game = new MastermindGame(id, generateSecret());
        games.put(id, game);
        return game.snapshot();
    }

    public MastermindGameSnapshot get(UUID id) {
        return find(id).snapshot();
    }

    public MastermindGameSnapshot guess(UUID id, List<MastermindColor> colors) {
        return find(id).guess(colors);
    }

    public MastermindGameSnapshot restart(UUID id) {
        MastermindGame game = find(id);
        game.restart(generateSecret());
        return game.snapshot();
    }

    private MastermindGame find(UUID id) {
        MastermindGame game = games.get(id);
        if (game == null) throw new MastermindNotFoundException("Partie introuvable.");
        return game;
    }

    private List<MastermindColor> generateSecret() {
        return random.ints(MastermindGame.CODE_LENGTH, 0, MastermindColor.values().length)
            .mapToObj(index -> MastermindColor.values()[index])
            .toList();
    }
}
