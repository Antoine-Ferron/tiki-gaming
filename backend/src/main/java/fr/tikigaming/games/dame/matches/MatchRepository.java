package fr.tikigaming.games.dame.matches;

import java.util.Optional;
import java.util.UUID;

/** Port de persistance ; le domaine ne connaît ni SQL, ni Supabase, ni Spring. */
public interface MatchRepository {

    Optional<Match> findById(UUID id);

    /** Enregistre un instantané immuable. Un échec doit être propagé au service appelant. */
    void save(Match match);
}
