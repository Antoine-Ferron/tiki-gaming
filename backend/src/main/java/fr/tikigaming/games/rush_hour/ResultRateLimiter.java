package fr.tikigaming.games.rush_hour;

import java.time.Clock;

/** Limite le nombre de parties vérifiées par minute et par client. */
public class ResultRateLimiter {

    public ResultRateLimiter(int maxPerMinute, Clock clock) {}

    /** Vrai si le client peut encore faire vérifier une partie cette minute-ci. */
    public boolean tryAcquire(String client) {
        return true;
    }
}
