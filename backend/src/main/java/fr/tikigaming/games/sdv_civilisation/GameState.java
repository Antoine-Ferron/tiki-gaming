package fr.tikigaming.games.sdv_civilisation;

import java.util.List;

/**
 * État complet d'une partie, mains des IA comprises : il ne quitte jamais le serveur tel quel.
 * {@code lastTurn} : ce que chacun a fait au dernier tour ; {@code conflicts} : jetons gagnés ou perdus par chaque
 * joueur aux conflits de l'âge qui vient de se terminer (vide en cours d'âge).
 */
public record GameState(
        int age,
        int turn,
        List<PlayerState> players,
        List<List<Card>> hands,
        boolean over,
        List<Card> discards,
        List<TurnEvent> lastTurn,
        List<Integer> conflicts) {

    public GameState {
        players = List.copyOf(players);
        hands = hands.stream().<List<Card>>map(List::copyOf).toList();
        discards = List.copyOf(discards);
        lastTurn = List.copyOf(lastTurn);
        conflicts = List.copyOf(conflicts);
    }

    public PlayerState player(int index) {
        return players.get(index);
    }
}
