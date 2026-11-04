package fr.tikigaming.games.sdv_civilisation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Stub : « mélange » toujours de la même façon, pour des tests déterministes (jamais flaky). {@link #KEEP} garde
 * l'ordre du paquet, {@link #REVERSE} le retourne (la dernière carte d'une main passe en premier).
 */
public final class FixedShuffler implements Shuffler {

    public static final FixedShuffler KEEP = new FixedShuffler(false);
    public static final FixedShuffler REVERSE = new FixedShuffler(true);

    private final boolean reverse;

    private FixedShuffler(boolean reverse) {
        this.reverse = reverse;
    }

    @Override
    public <T> List<T> shuffle(List<T> items) {
        List<T> copy = new ArrayList<>(items);
        if (reverse) Collections.reverse(copy);
        return copy;
    }
}
