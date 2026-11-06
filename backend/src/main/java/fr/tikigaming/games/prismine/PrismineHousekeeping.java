package fr.tikigaming.games.prismine;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Purge planifiée des expéditions abandonnées : la table prismine_runs ne grossit pas indéfiniment. */
@Component
class PrismineHousekeeping {

    private static final Logger log = LoggerFactory.getLogger(PrismineHousekeeping.class);

    private final PrismineService service;

    PrismineHousekeeping(PrismineService service) {
        this.service = service;
    }

    /** Toutes les heures, la première fois une heure après le démarrage. */
    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT1H")
    void purgeInactiveRuns() {
        try {
            service.purgeInactiveRuns();
        } catch (RuntimeException e) {
            log.warn("Purge des expéditions Prismine abandonnées impossible, nouvel essai dans une heure", e);
        }
    }
}
