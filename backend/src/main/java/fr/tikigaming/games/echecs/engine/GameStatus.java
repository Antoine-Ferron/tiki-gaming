package fr.tikigaming.games.echecs.engine;

/** État de la partie pour le camp qui a le trait (règles L1 et F1 à F5). */
public enum GameStatus {
    ONGOING(false),
    CHECK(false),
    CHECKMATE(true),
    STALEMATE(true),
    DRAW_INSUFFICIENT_MATERIAL(true),
    DRAW_FIFTY_MOVES(true);

    private final boolean over;

    GameStatus(boolean over) {
        this.over = over;
    }

    /** Règle F8 : une partie terminée n'accepte plus aucun coup. */
    public boolean isOver() {
        return over;
    }
}
