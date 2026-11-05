package fr.tikigaming.games.dame.demo;

import fr.tikigaming.TikiGamingApplication;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.persistence.DameDatabase;
import fr.tikigaming.games.dame.persistence.SupabaseMatchRepository;
import org.springframework.boot.SpringApplication;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Démo invitée locale sur les vrais services éphémères des IT ; aucune migration distante. */
public final class DameLocalDemo {

    private DameLocalDemo() {}

    public static void main(String[] args) throws Exception {
        DameDatabase database = new DameDatabase();
        database.start();
        Thread cleanup = new Thread(database::close, "dame-demo-cleanup");
        Runtime.getRuntime().addShutdownHook(cleanup);
        try {
            MatchRepository repository = new SupabaseMatchRepository(
                    RestClient.builder()
                            .baseUrl(database.restUrl())
                            .defaultHeader("Authorization", "Bearer " + database.serviceToken())
                            .build(),
                    JsonMapper.builder().build());
            SpringApplication application = new SpringApplication(TikiGamingApplication.class);
            application.addInitializers(context -> ((GenericApplicationContext) context)
                    .registerBean(
                            "dameDemoRepository",
                            MatchRepository.class,
                            () -> repository,
                            bean -> bean.setPrimary(true)));
            application.run(
                    "--server.port=" + Integer.getInteger("dame.demo.port", 8080),
                    "--spring.config.import=",
                    "--debug=false",
                    "--logging.level.root=INFO",
                    "--spring.security.oauth2.client.registration.google.client-id=dame-demo",
                    "--spring.security.oauth2.client.registration.google.client-secret=dame-demo",
                    "--tiki.frontend-url=http://localhost:5173",
                    "--tiki.supabase.url=https://dame-demo.supabase.invalid",
                    "--tiki.supabase.anon-key=dame-demo-anon",
                    "--tiki.supabase.service-role-key=dame-demo-service",
                    "--tiki.supabase.jwt-secret=tiki-dame-demo-secret-with-at-least-32-characters",
                    "--logging.level.fr.tikigaming=INFO");
        } catch (Exception | Error error) {
            Runtime.getRuntime().removeShutdownHook(cleanup);
            database.close();
            throw error;
        }
    }
}
