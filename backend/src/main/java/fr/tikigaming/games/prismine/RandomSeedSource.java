package fr.tikigaming.games.prismine;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/** Graines imprévisibles : un joueur ne peut pas deviner la carte de l'étage suivant. */
@Component
public class RandomSeedSource implements SeedSource {

    private final SecureRandom random = new SecureRandom();

    @Override
    public long nextSeed() {
        return Integer.toUnsignedLong(random.nextInt());
    }
}
