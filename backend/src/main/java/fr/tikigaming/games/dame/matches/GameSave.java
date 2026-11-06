package fr.tikigaming.games.dame.matches;

import java.util.Objects;

/** Instantané serveur opaque pour le stockage ; le navigateur ne fournit jamais son contenu. */
public record GameSave(Match match, String ownerHash, int version, String state) {
    public GameSave {
        Objects.requireNonNull(match);
        Objects.requireNonNull(ownerHash);
        Objects.requireNonNull(state);
        if (!ownerHash.matches("[0-9a-f]{64}") || version < 0 || state.isBlank()) {
            throw new IllegalArgumentException("Sauvegarde invalide.");
        }
    }
}
