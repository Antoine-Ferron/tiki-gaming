package fr.tikigaming.games.prismine;

import java.util.Optional;
import java.util.UUID;

/** Contrat : registre des expéditions en cours. En production dans Supabase, en mémoire dans les tests. */
public interface RunRepository {

    void save(Run run);

    Optional<Run> find(UUID id);

    void delete(UUID id);
}
