package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Resource.GLASS;
import static fr.tikigaming.games.sdv_civilisation.Resource.ORE;
import static fr.tikigaming.games.sdv_civilisation.Resource.STONE;
import static fr.tikigaming.games.sdv_civilisation.Resource.WOOD;

import java.util.List;

/** Plateaux merveille de la version contre IA (créations du jeu). Voir docs/games/sdv-civilisation/regles.md */
public final class Wonders {

    public static final List<Wonder> ALL = List.of(
            new Wonder(
                    "Temple d’Ysar",
                    ORE,
                    List.of(
                            WonderStage.points(Cost.of(ORE), 3),
                            WonderStage.shields(Cost.of(WOOD, WOOD), 2),
                            WonderStage.points(Cost.of(STONE, STONE, GLASS), 7))),
            new Wonder(
                    "Phare de Sélène",
                    GLASS,
                    List.of(
                            WonderStage.points(Cost.of(WOOD), 3),
                            WonderStage.coins(Cost.of(STONE, STONE), 6),
                            WonderStage.points(Cost.of(ORE, ORE, GLASS), 7))),
            new Wonder(
                    "Jardins de Mirah",
                    WOOD,
                    List.of(
                            WonderStage.points(Cost.of(WOOD), 3),
                            WonderStage.shields(Cost.of(ORE, ORE), 2),
                            WonderStage.points(Cost.of(STONE, STONE, STONE), 7))),
            new Wonder(
                    "Citadelle d’Orkan",
                    STONE,
                    List.of(
                            WonderStage.points(Cost.of(STONE), 3),
                            WonderStage.coins(Cost.of(GLASS, WOOD), 6),
                            WonderStage.points(Cost.of(WOOD, WOOD, ORE), 7))));

    private Wonders() {}

    public static Wonder byName(String name) {
        return ALL.stream()
                .filter(wonder -> wonder.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new GameRuleException("Merveille inconnue : " + name));
    }
}
