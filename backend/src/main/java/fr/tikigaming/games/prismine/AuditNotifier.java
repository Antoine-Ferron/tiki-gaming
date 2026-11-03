package fr.tikigaming.games.prismine;

import java.time.Duration;
import java.util.UUID;

/** Contrat : passerelle d'audit anti-triche. Appelée au plus une fois par expédition. */
public interface AuditNotifier {

    /**
     * Un étage a été validé plus vite que {@link Expedition#MIN_FLOOR_DURATION}.
     *
     * @param userId joueur connecté, ou null pour un invité
     */
    void floorTooFast(UUID runId, String userId, int depth, Duration duration);
}
