package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Coût d'une carte ou d'une étape de merveille : des pièces et/ou des ressources (une entrée par unité). */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record Cost(int coins, List<Resource> resources) {

    public static final Cost FREE = new Cost(0, List.of());

    public Cost {
        resources = resources == null ? List.of() : List.copyOf(resources);
    }

    public static Cost of(Resource... resources) {
        return new Cost(0, List.of(resources));
    }

    public static Cost coins(int coins) {
        return new Cost(coins, List.of());
    }
}
