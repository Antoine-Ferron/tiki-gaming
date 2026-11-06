package fr.tikigaming.games.sudoku;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Partie perdue (trop d'erreurs) : plus aucune saisie ni vérification n'est acceptée, 409. */
public class SudokuGameOverException extends ApiException {
    public SudokuGameOverException() {
        super(HttpStatus.CONFLICT, "Partie perdue : trop d'erreurs. Lance-en une nouvelle.");
    }
}
