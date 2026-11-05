package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/** Pioche commune aux tours et aux pouvoirs, avec recyclage de la défausse, sans modifier l'état fourni. */
final class CardDraw {
    private final Consumer<List<CardInstance>> shuffle;

    CardDraw() {
        this(Collections::shuffle);
    }

    CardDraw(Consumer<List<CardInstance>> shuffle) {
        this.shuffle = shuffle;
    }

    GameState draw(GameState state, int seat, int count) {
        if (count == 0) return state;
        if (state.drawPile().size() + state.discardPile().size() < count) {
            throw new IllegalStateException("Il ne reste pas assez de cartes dans la pioche et la défausse.");
        }
        List<CardInstance> pile = new ArrayList<>(state.drawPile());
        List<CardInstance> discarded = new ArrayList<>(state.discardPile());
        List<CardInstance> drawn = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            if (pile.isEmpty()) {
                shuffle.accept(discarded);
                pile.addAll(discarded);
                discarded.clear();
            }
            drawn.add(pile.removeFirst());
            if (pile.isEmpty() && !discarded.isEmpty()) {
                shuffle.accept(discarded);
                pile.addAll(discarded);
                discarded.clear();
            }
        }
        List<GameState.Player> players = state.players().stream()
                .map(player -> {
                    if (player.seat() != seat) return player;
                    List<CardInstance> hand = new ArrayList<>(player.hand());
                    hand.addAll(drawn);
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
        return new GameState(players, List.copyOf(pile), List.copyOf(discarded), state.currentSeat(), state.phase());
    }
}
