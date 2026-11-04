package fr.tikigaming.realtime;

/**
 * Vue publique d'une salle de jeu : jamais l'identité des autres comptes assis, seulement des compteurs
 * (comme {@code TableSeat} pour BANG!).
 */
public record RoomView(String gameSlug, String code, int seat, int playerCount, int maxPlayers) {}
