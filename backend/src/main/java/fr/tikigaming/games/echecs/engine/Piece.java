package fr.tikigaming.games.echecs.engine;

/** Une pièce : sa couleur et son type. */
public record Piece(Color color, PieceType type) {

    /** Lit une pièce depuis sa lettre FEN : majuscule = Blancs, minuscule = Noirs. */
    public static Piece fromFen(char letter) {
        Color color = Character.isUpperCase(letter) ? Color.WHITE : Color.BLACK;
        return new Piece(color, PieceType.fromFen(letter));
    }

    /** Écrit la pièce avec sa lettre FEN : majuscule pour les Blancs, minuscule pour les Noirs. */
    public char toFen() {
        char letter = type.fenLetter();
        return color == Color.WHITE ? Character.toUpperCase(letter) : letter;
    }
}
