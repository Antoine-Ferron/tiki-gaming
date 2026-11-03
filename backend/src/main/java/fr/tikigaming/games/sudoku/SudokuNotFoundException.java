package fr.tikigaming.games.sudoku;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Partie inconnue, expirée ou déjà résolue : 404. */
public class SudokuNotFoundException extends ApiException {
    public SudokuNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
