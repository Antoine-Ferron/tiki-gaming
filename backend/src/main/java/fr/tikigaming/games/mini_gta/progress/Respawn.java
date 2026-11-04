package fr.tikigaming.games.mini_gta.progress;

/** Frais prélevés à la réapparition. */
public record Respawn(int fee, Progress progress) {
    public enum Reason {
        DEAD,
        BUSTED
    }
}
