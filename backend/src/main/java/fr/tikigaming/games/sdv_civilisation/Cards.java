package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Resource.GLASS;
import static fr.tikigaming.games.sdv_civilisation.Resource.ORE;
import static fr.tikigaming.games.sdv_civilisation.Resource.STONE;
import static fr.tikigaming.games.sdv_civilisation.Resource.WOOD;

import java.util.List;

/**
 * Catalogue de la version contre IA (créations du jeu) : 7 cartes par âge, chacune en un exemplaire par joueur.
 * Voir docs/games/sdv-civilisation/regles.md#version-contre-ia
 */
public final class Cards {

    public static final int PER_AGE = 7;

    private static final List<List<Card>> BY_AGE = List.of(
            List.of(
                    Card.resource("Chantier", 1, CardColor.BROWN, Cost.FREE, WOOD),
                    Card.resource("Cavité", 1, CardColor.BROWN, Cost.FREE, STONE),
                    Card.resource("Filon", 1, CardColor.BROWN, Cost.coins(1), ORE),
                    Card.resource("Verrerie", 1, CardColor.GREY, Cost.FREE, GLASS),
                    Card.civil("Bains", 1, Cost.of(STONE), 3),
                    Card.military("Palissade", 1, Cost.of(WOOD), 1),
                    Card.science("Atelier", 1, Cost.of(GLASS), ScienceSymbol.GEAR)),
            List.of(
                    Card.resource("Scierie", 2, CardColor.BROWN, Cost.coins(1), WOOD, WOOD),
                    Card.resource("Carrière", 2, CardColor.BROWN, Cost.coins(1), STONE, STONE),
                    Card.commerce("Taverne", 2, Cost.FREE, 5),
                    Card.civil("Aqueduc", 2, Cost.of(STONE, STONE, STONE), 5).chainedFrom("Bains"),
                    Card.military("Écuries", 2, Cost.of(ORE, WOOD), 2).chainedFrom("Palissade"),
                    Card.science("Bibliothèque", 2, Cost.of(STONE, STONE), ScienceSymbol.TABLET),
                    Card.science("Dispensaire", 2, Cost.of(ORE, GLASS), ScienceSymbol.COMPASS)),
            List.of(
                    Card.civil("Panthéon", 3, Cost.of(STONE, STONE, ORE, GLASS), 7)
                            .chainedFrom("Aqueduc"),
                    Card.military("Arsenal", 3, Cost.of(WOOD, WOOD, ORE), 3).chainedFrom("Écuries"),
                    Card.science("Université", 3, Cost.of(WOOD, WOOD, GLASS), ScienceSymbol.TABLET)
                            .chainedFrom("Bibliothèque"),
                    Card.science("Observatoire", 3, Cost.of(ORE, ORE, GLASS), ScienceSymbol.GEAR)
                            .chainedFrom("Atelier"),
                    Card.science("Académie", 3, Cost.of(STONE, STONE, GLASS), ScienceSymbol.COMPASS)
                            .chainedFrom("Dispensaire"),
                    Card.guild("Guilde des bâtisseurs", Cost.of(STONE, STONE, ORE), CardColor.BROWN, CardColor.GREY),
                    Card.guild("Guilde des magistrats", Cost.of(WOOD, WOOD, GLASS), CardColor.BLUE)));

    private Cards() {}

    public static List<Card> ofAge(int age) {
        if (age < 1 || age > BY_AGE.size()) throw new IllegalArgumentException("Âge inconnu : " + age);
        return BY_AGE.get(age - 1);
    }
}
