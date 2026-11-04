package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Une carte bâtiment. Un seul effet par carte : ressources produites, points, boucliers, symbole de science,
 * pièces ou guilde. {@code chainFrom} : bâtiment déjà construit qui rend celui-ci gratuit.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record Card(
        String name,
        int age,
        CardColor color,
        Cost cost,
        String chainFrom,
        List<Resource> produces,
        int points,
        int shields,
        ScienceSymbol science,
        int coins,
        List<CardColor> guild) {

    public Card {
        produces = produces == null ? List.of() : List.copyOf(produces);
        guild = guild == null ? List.of() : List.copyOf(guild);
    }

    static Card resource(String name, int age, CardColor color, Cost cost, Resource... produces) {
        return new Card(name, age, color, cost, null, List.of(produces), 0, 0, null, 0, List.of());
    }

    static Card civil(String name, int age, Cost cost, int points) {
        return new Card(name, age, CardColor.BLUE, cost, null, List.of(), points, 0, null, 0, List.of());
    }

    static Card military(String name, int age, Cost cost, int shields) {
        return new Card(name, age, CardColor.RED, cost, null, List.of(), 0, shields, null, 0, List.of());
    }

    static Card science(String name, int age, Cost cost, ScienceSymbol symbol) {
        return new Card(name, age, CardColor.GREEN, cost, null, List.of(), 0, 0, symbol, 0, List.of());
    }

    static Card commerce(String name, int age, Cost cost, int coins) {
        return new Card(name, age, CardColor.YELLOW, cost, null, List.of(), 0, 0, null, coins, List.of());
    }

    /** Guilde de l'âge III : 1 point par carte de ces couleurs chez les deux voisins. */
    static Card guild(String name, Cost cost, CardColor... counted) {
        return new Card(name, 3, CardColor.PURPLE, cost, null, List.of(), 0, 0, null, 0, List.of(counted));
    }

    Card chainedFrom(String previous) {
        return new Card(name, age, color, cost, previous, produces, points, shields, science, coins, guild);
    }
}
