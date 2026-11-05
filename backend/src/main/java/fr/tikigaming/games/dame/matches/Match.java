package fr.tikigaming.games.dame.matches;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Player;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Rencontre locale : les noms désignent les participants, pas des comptes authentifiés. */
public record Match(
        UUID id, String whiteName, String blackName, Instant startedAt, GameStatus status, Instant finishedAt) {

    public Match {
        Objects.requireNonNull(id, "L'identifiant de rencontre est requis.");
        Objects.requireNonNull(startedAt, "La date de début est requise.");
        Objects.requireNonNull(status, "Le statut est requis.");
        whiteName = normalizeName(whiteName);
        blackName = normalizeName(blackName);
        if (status == GameStatus.IN_PROGRESS) {
            if (finishedAt != null) {
                throw new IllegalArgumentException("Une rencontre en cours ne peut pas avoir de date de fin.");
            }
        } else if (finishedAt == null || finishedAt.isBefore(startedAt)) {
            throw new IllegalArgumentException("La date de fin est requise et ne peut pas précéder le début.");
        }
    }

    public static Match start(UUID id, String whiteName, String blackName, Instant at) {
        return new Match(id, whiteName, blackName, at, GameStatus.IN_PROGRESS, null);
    }

    /** Produit un nouvel instantané ; une rencontre terminée ne peut pas être clôturée une seconde fois. */
    public Match finish(GameStatus result, Instant at) {
        Objects.requireNonNull(result, "Le résultat est requis.");
        if (status != GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cette rencontre est déjà terminée.");
        }
        if (result == GameStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("La partie n'est pas terminée.");
        }
        return new Match(id, whiteName, blackName, startedAt, result, at);
    }

    public Optional<Player> winner() {
        return switch (status) {
            case IN_PROGRESS -> Optional.empty();
            case WHITE_WON -> Optional.of(Player.WHITE);
            case BLACK_WON -> Optional.of(Player.BLACK);
        };
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Indique le nom de chaque joueur.");
        }
        String normalized = name.strip();
        if (normalized.length() > 50) {
            throw new IllegalArgumentException("Le nom de chaque joueur ne peut pas dépasser 50 caractères.");
        }
        return normalized;
    }
}
