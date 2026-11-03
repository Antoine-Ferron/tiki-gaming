package fr.tikigaming.games.prismine;

import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Passerelle d'audit de production : un avertissement dans les logs (JSON en production), à surveiller. */
@Component
public class LogAuditNotifier implements AuditNotifier {

    private static final Logger log = LoggerFactory.getLogger(LogAuditNotifier.class);

    @Override
    public void floorTooFast(UUID runId, String userId, int depth, Duration duration) {
        log.warn(
                "Audit Prismine : étage {} validé en {} ms (expédition {}, joueur {})",
                depth,
                duration.toMillis(),
                runId,
                userId == null ? "invité" : userId);
    }
}
