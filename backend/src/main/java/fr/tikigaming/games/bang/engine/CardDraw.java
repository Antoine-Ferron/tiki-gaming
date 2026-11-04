package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.List;

/** Transfert des cartes existantes de la pioche vers une main, sans modifier l'état fourni. */
final class CardDraw {
    GameState draw(GameState state, int seat, int count) {
        if (count == 0) return state;
        if (state.drawPile().size() < count) {
            throw new IllegalStateException("Il ne reste pas assez de cartes dans la pioche.");
        }
        List<GameState.Player> players = state.players().stream()
                .map(player -> {
                    if (player.seat() != seat) return player;
                    List<CardInstance> hand = new ArrayList<>(player.hand());
                    hand.addAll(state.drawPile().subList(0, count));
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
        return new GameState(
                players,
                List.copyOf(state.drawPile().subList(count, state.drawPile().size())),
                state.discardPile(),
                state.currentSeat(),
                state.phase());
    }
}
