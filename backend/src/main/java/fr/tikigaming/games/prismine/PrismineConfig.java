package fr.tikigaming.games.prismine;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Branche le service sur les implémentations de production de ses contrats ; active la purge planifiée. */
@Configuration
@EnableScheduling
class PrismineConfig {

    @Bean
    PrismineService prismineService(RunRepository runs, ScoreRegistry scores, AuditNotifier audit, SeedSource seeds) {
        // Horloge système propre au jeu : pas de bean Clock global imposé au reste de la plateforme.
        return new PrismineService(runs, scores, audit, seeds, Clock.systemUTC());
    }
}
