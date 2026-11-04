package fr.tikigaming.games.bang.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** Seules les informations auxquelles le compte connecté a droit. */
public record PlayerGameView(
        String code,
        int seat,
        int currentSeat,

        @Schema(description = "Phase du joueur actif : DRAW (piocher), PLAY (jouer) ou DISCARD (se défausser)")
        GameState.Phase phase,

        @Schema(description = "Rôle privé du compte connecté")
        Role role,

        @Schema(description = "Cartes en main du compte connecté uniquement")
        List<Card> hand,

        List<Player> players) {
    public record Card(String id, CardType type) {}

    public record Player(
            int seat,
            BangCharacter character,
            int health,
            int maxHealth,

            @Schema(description = "Cartes posées, toujours vide au démarrage")
            List<Card> playedCards,

            int handCount,

            @JsonInclude(JsonInclude.Include.NON_NULL)
            @Schema(
                    description = "SHERIFF pour le Shérif ; absent pour les autres joueurs",
                    allowableValues = "SHERIFF")
            Role role) {}
}
