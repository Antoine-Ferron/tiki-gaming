package fr.tikigaming.games.echecs.engine;

/** Type d'une pièce, avec sa lettre FEN (en minuscule). */
public enum PieceType {
    PAWN('p'),
    KNIGHT('n'),
    BISHOP('b'),
    ROOK('r'),
    QUEEN('q'),
    KING('k');

    private final char fenLetter;

    PieceType(char fenLetter) {
        this.fenLetter = fenLetter;
    }

    char fenLetter() {
        return fenLetter;
    }

    /** Retrouve le type d'après sa lettre FEN, en majuscule ou en minuscule. */
    static PieceType fromFen(char letter) {
        char lower = Character.toLowerCase(letter);
        for (PieceType type : values()) {
            if (type.fenLetter == lower) {
                return type;
            }
        }
        throw new IllegalArgumentException("Lettre de pièce inconnue : '" + letter + "'");
    }
}
