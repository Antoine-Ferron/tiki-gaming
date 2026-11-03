package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Accès PostgREST de Prismine avec la clé service_role (contourne la RLS) : réservé au serveur. Une panne de Supabase
 * devient une erreur 502 avec un message pour le joueur ; le détail va dans les logs.
 */
@Component
public class PrismineSupabase {

    static final String UNAVAILABLE = "Le serveur de Prismine rencontre un problème. Réessaie plus tard.";

    private static final Logger log = LoggerFactory.getLogger(PrismineSupabase.class);

    private final RestClient rest;

    public PrismineSupabase(RestClient.Builder builder, TikiProperties props) {
        TikiProperties.Supabase cfg = props.supabase();
        this.rest = builder.baseUrl(cfg.url())
                .defaultHeaders(h -> {
                    h.set("apikey", cfg.serviceRoleKey());
                    h.setBearerAuth(cfg.serviceRoleKey());
                })
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
                    log.error(
                            "PostgREST a répondu {} sur {} {}",
                            res.getStatusCode().value(),
                            req.getMethod(),
                            req.getURI().getPath());
                    throw new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
                })
                .build();
    }

    /** Exécute un appel ; Supabase injoignable → 502. */
    <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (ResourceAccessException e) {
            log.error("Supabase injoignable", e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
        }
    }

    RestClient rest() {
        return rest;
    }
}
