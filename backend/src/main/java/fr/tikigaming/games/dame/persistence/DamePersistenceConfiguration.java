package fr.tikigaming.games.dame.persistence;

import fr.tikigaming.config.TikiProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

/** Assemblage technique : seule la clé serveur permet l'accès à la table privée. */
@Configuration(proxyBeanMethods = false)
public class DamePersistenceConfiguration {

    @Bean
    SupabaseMatchRepository dameMatchRepository(RestClient.Builder builder, TikiProperties props, ObjectMapper mapper) {
        String key = props.supabase().serviceRoleKey();
        RestClient rest = builder.baseUrl(props.supabase().url() + "/rest/v1")
                .defaultHeaders(headers -> {
                    headers.set("apikey", key);
                    headers.setBearerAuth(key);
                })
                .build();
        return new SupabaseMatchRepository(rest, mapper);
    }
}
