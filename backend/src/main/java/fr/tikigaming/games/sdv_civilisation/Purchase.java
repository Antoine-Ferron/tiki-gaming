package fr.tikigaming.games.sdv_civilisation;

/** Achat de {@code quantity} ressources par {@code buyer} à son voisin {@code seller}. */
public record Purchase(String buyer, String seller, Resource resource, int quantity) {}
