package fr.tikigaming.games.dame.api;

import fr.tikigaming.games.dame.matches.MatchRepository;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
public class DameApiConfiguration {
    @Bean
    DameApplicationService dameApplicationService(MatchRepository repository, ObjectMapper mapper) {
        return new DameApplicationService(repository, Clock.tickMillis(ZoneOffset.UTC), UUID::randomUUID, mapper);
    }
}
