package fr.tikigaming.games.bang.model;

import fr.tikigaming.games.bang.cards.CardType;

/** Un exemplaire physique de carte à jouer ; plusieurs exemplaires peuvent avoir le même type. */
public record CardInstance(String id, CardType type) {}
