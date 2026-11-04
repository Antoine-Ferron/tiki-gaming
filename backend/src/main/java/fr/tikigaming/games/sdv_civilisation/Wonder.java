package fr.tikigaming.games.sdv_civilisation;

import java.util.List;

/** Plateau merveille : la ressource qu'il produit dès le début, et ses étapes à bâtir dans l'ordre. */
public record Wonder(String name, Resource resource, List<WonderStage> stages) {

    public Wonder {
        stages = List.copyOf(stages);
    }
}
