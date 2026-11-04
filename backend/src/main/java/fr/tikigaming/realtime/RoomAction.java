package fr.tikigaming.realtime;

/**
 * Payload de {@code /app/rooms/{slug}/{code}/actions} : relais générique d'un évènement de jeu public (visible par
 * tous les joueurs assis). {@code actionId} déduplique un double clic ou le renvoi de la même action. Un jeu avec de
 * l'état caché par joueur n'utilise pas ce relais (voir le socle, section « forme des messages »).
 */
public record RoomAction(String type, String actionId, Object data) {}
