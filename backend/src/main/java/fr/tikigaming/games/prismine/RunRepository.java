package fr.tikigaming.games.prismine;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Contrat : registre des expéditions en cours. En production dans Supabase, en mémoire dans les tests. */
public interface RunRepository {

    /** Message renvoyé (409) quand une autre requête a modifié l'expédition entre sa lecture et son écriture. */
    String CONFLICT = "Ton expédition vient de changer ailleurs : recharge la page pour reprendre.";

    void insert(Run run);

    /**
     * Remplace l'expédition si elle est encore à la version {@code run.version() - 1}, sinon lève une
     * {@code ApiException} 409 ({@link #CONFLICT}) : deux requêtes simultanées ne s'écrasent jamais.
     */
    void update(Run run);

    Optional<Run> find(UUID id);

    void delete(UUID id);

    /** Supprime les expéditions en cours d'un joueur connecté (une seule à la fois par compte). */
    void deleteByUser(String userId);

    /** Supprime les expéditions dont la dernière écriture est antérieure à {@code cutoff}. */
    void deleteInactiveSince(Instant cutoff);
}
