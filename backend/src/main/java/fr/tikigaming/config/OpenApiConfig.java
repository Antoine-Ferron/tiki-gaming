package fr.tikigaming.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String DESCRIPTION = """
            API du backend Tiki Gaming : authentification et, à terme, logique serveur des jeux \
            (`/api/games/<slug>/...`).

            **Session** : la connexion pose un cookie de session `JSESSIONID` (HttpOnly). \
            Dans Swagger UI, se connecter d'abord (`POST /api/auth/login`, ou Google depuis le front) : \
            le navigateur renvoie ensuite le cookie automatiquement.

            **CSRF** : chaque `POST` exige l'en-tête `X-XSRF-TOKEN`, copie du cookie `XSRF-TOKEN`. \
            Appeler `GET /api/auth/session` une première fois pour obtenir le cookie : Swagger UI \
            remplit ensuite l'en-tête tout seul.

            **Données** : les scores s'enregistrent par `POST /api/scores` (le navigateur n'a pas le droit \
            d'écrire dans la table). Classement, sauvegardes et profils passent par Supabase, avec le JWT \
            renvoyé par `GET /api/auth/session`.""";

    @Bean
    OpenAPI tikiGamingOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Tiki Gaming API").version("0.1.0").description(DESCRIPTION));
    }
}
