package fr.tikigaming.games.echecs.engine;

/** Une pièce : sa couleur et son type. */
public record Piece(Color color, PieceType type) {

    /** Lit une pièce depuis sa lettre FEN : majuscule = Blancs, minuscule = Noirs. */
    public static Piece fromFen(char letter) {
        Color color = Character.isUpperCase(letter) ? Color.WHITE : Color.BLACK;
        return new Piece(color, PieceType.KNIGHT);
    }
}
