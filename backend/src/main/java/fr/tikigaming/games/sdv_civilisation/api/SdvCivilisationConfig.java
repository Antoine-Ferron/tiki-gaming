package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.games.sdv_civilisation.AuditNotifier;
import fr.tikigaming.games.sdv_civilisation.Clock;
import fr.tikigaming.games.sdv_civilisation.CurrencyConverter;
import fr.tikigaming.games.sdv_civilisation.Engine;
import fr.tikigaming.games.sdv_civilisation.LogAuditNotifier;
import fr.tikigaming.games.sdv_civilisation.RandomShuffler;
import fr.tikigaming.games.sdv_civilisation.Shuffler;
import fr.tikigaming.games.sdv_civilisation.StandardTrade;
import fr.tikigaming.games.sdv_civilisation.SystemClock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/** Branchement du jeu : implémentations de production des contrats du domaine, et client REST Supabase. */
@Configuration
public class SdvCivilisationConfig {

    static final String SLUG = "sdv-civilisation";

    @Bean
    CurrencyConverter sdvCivilisationTrade() {
        return new StandardTrade();
    }

    @Bean
    Clock sdvCivilisationClock() {
        return new SystemClock();
    }

    @Bean
    Shuffler sdvCivilisationShuffler() {
        return new RandomShuffler();
    }

    @Bean
    AuditNotifier sdvCivilisationAudit() {
        return new LogAuditNotifier();
    }

    @Bean
    Engine sdvCivilisationEngine(CurrencyConverter trade, Shuffler shuffler, AuditNotifier audit) {
        return new Engine(trade, shuffler, audit);
    }

    @Bean
    RestClient sdvCivilisationSupabase(RestClient.Builder builder, TikiProperties props) {
        return supabase(builder, props);
    }

    /** Client de l'API REST de Supabase avec la clé service (côté serveur uniquement : elle ignore la RLS). */
    static RestClient supabase(RestClient.Builder builder, TikiProperties props) {
        String key = props.supabase().serviceRoleKey();
        return builder.baseUrl(props.supabase().url())
                .defaultHeaders(h -> {
                    h.set("apikey", key);
                    h.setBearerAuth(key);
                })
                .build();
    }
}
