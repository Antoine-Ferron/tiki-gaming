package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.List;

/** Résultat d'une règle de tir : le nouvel état et les cartes à ajouter à la défausse. */
public record ShotOutcome(GameState state, List<CardInstance> discarded) {}
