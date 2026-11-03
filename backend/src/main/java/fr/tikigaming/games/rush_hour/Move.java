package fr.tikigaming.games.rush_hour;

/** Un coup : glisser le véhicule {@code vehicleId} de {@code delta} cases (négatif = gauche ou haut). */
public record Move(char vehicleId, int delta) {}
