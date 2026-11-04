package fr.tikigaming.games.dame.persistence;

import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

/** Adaptateur PostgREST ; le client fourni porte l'URL REST et les droits serveur. */
public final class SupabaseMatchRepository implements MatchRepository {

    private final RestClient rest;
    private final ObjectMapper mapper;

    public SupabaseMatchRepository(RestClient rest, ObjectMapper mapper) {
        this.rest = rest;
        this.mapper = mapper;
    }

    @Override
    public Optional<Match> findById(UUID id) {
        return Optional.empty();
    }

    @Override
    public void save(Match match) {
        // Squelette RED : aucune I/O avant les tests d'intégration.
    }
}
