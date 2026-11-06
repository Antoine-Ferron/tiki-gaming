package fr.tikigaming.games.prismine;

import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Branche le service et le contrôleur de Prismine sur les implémentations de production de leurs contrats. */
@Configuration
class PrismineConfig {

    // Horloge système propre au jeu : pas de bean Clock global imposé au reste de la plateforme.
    private static final Clock CLOCK = Clock.systemUTC();

    @Bean
    PrismineService prismineService(RunRepository runs, ScoreRegistry scores, AuditNotifier audit, SeedSource seeds) {
        return new PrismineService(runs, scores, audit, seeds, CLOCK);
    }

    @Bean
    StartLimiter prismineStartLimiter(
            @Value("${tiki.prismine.max-starts-per-window:" + StartLimiter.MAX_STARTS + "}") int maxStarts) {
        return new StartLimiter(CLOCK, maxStarts);
    }
}
