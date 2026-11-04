package fr.tikigaming.games.dame;

import java.util.List;

/** Origine et cases d'arrivée successives, sans validation des règles de déplacement. */
public record Move(Position from, List<Position> landings) {

    public Move {
        landings = List.copyOf(landings);
    }
}
