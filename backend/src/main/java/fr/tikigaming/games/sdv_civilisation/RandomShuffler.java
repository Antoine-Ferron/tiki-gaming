package fr.tikigaming.games.sdv_civilisation;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** Implémentation de production : mélange aléatoire, imprévisible pour le joueur. */
public final class RandomShuffler implements Shuffler {

    private final Random random = new SecureRandom();

    @Override
    public <T> List<T> shuffle(List<T> items) {
        List<T> copy = new ArrayList<>(items);
        Collections.shuffle(copy, random);
        return copy;
    }
}
