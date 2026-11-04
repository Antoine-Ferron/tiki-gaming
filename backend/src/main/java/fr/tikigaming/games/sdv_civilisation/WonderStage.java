package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Étape d'une merveille : son coût et un seul gain (points, pièces ou boucliers). */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record WonderStage(Cost cost, int points, int coins, int shields) {

    static WonderStage points(Cost cost, int points) {
        return new WonderStage(cost, points, 0, 0);
    }

    static WonderStage coins(Cost cost, int coins) {
        return new WonderStage(cost, 0, coins, 0);
    }

    static WonderStage shields(Cost cost, int shields) {
        return new WonderStage(cost, 0, 0, shields);
    }
}
