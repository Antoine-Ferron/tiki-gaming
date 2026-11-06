package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.resilience.CircuitBreaker;
import fr.tikigaming.resilience.CircuitOpenException;
import java.time.Clock;
import java.time.Duration;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Accès PostgREST de Prismine avec la clé service_role (contourne la RLS) : réservé au serveur. Une panne de Supabase
 * devient une erreur 502 avec un message pour le joueur ; le détail va dans les logs.
 *
 * <p>Résilience : les timeouts viennent de {@code spring.http.clients.*} (application.yml). Un disjoncteur s'ouvre
 * après plusieurs pannes consécutives et répond alors 503 tout de suite, sans attendre Supabase.
 */
@Component
public class PrismineSupabase {

    static final String UNAVAILABLE = "Le serveur de Prismine rencontre un problème. Réessaie plus tard.";

    private static final Logger log = LoggerFactory.getLogger(PrismineSupabase.class);

    private final RestClient rest;
    private final CircuitBreaker breaker;

    @Autowired
    public PrismineSupabase(
            RestClient.Builder builder,
            TikiProperties props,
            @Value("${tiki.resilience.prismine.failure-threshold:5}") int failureThreshold,
            @Value("${tiki.resilience.prismine.open-duration:30s}") Duration openDuration) {
        this(
                builder,
                props,
                new CircuitBreaker(failureThreshold, openDuration, Clock.systemUTC(), PrismineSupabase::isOutage));
    }

    PrismineSupabase(RestClient.Builder builder, TikiProperties props, CircuitBreaker breaker) {
        this.breaker = breaker;
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

    /** Panne de Supabase (injoignable, timeout, erreur HTTP), par opposition à un refus métier. */
    static boolean isOutage(RuntimeException e) {
        return e instanceof ApiException api && api.status() == HttpStatus.BAD_GATEWAY;
    }

    /** Exécute un appel ; Supabase injoignable → 502, disjoncteur ouvert → 503 sans appel réseau. */
    <T> T call(Supplier<T> request) {
        try {
            return breaker.call(() -> attempt(request));
        } catch (CircuitOpenException e) {
            log.warn(
                    "Disjoncteur de Prismine ouvert : appel refusé sans contacter Supabase (essai dans {})",
                    e.retryAfter());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE);
        }
    }

    private static <T> T attempt(Supplier<T> request) {
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
