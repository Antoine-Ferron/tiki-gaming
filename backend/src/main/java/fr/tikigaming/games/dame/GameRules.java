package fr.tikigaming.games.dame;

import java.util.List;

/** Contrat du moteur pour les tests de spécification ; calculs encore RED. */
public class GameRules {

    public List<Move> legalMoves(Board board, Player player) {
        return List.of();
    }

    public GameStatus status(Board board, Player toMove) {
        return GameStatus.IN_PROGRESS;
    }
}
