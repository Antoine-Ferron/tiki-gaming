package fr.tikigaming.games.sudoku;

import fr.tikigaming.config.ApiException;
import org.springframework.http.HttpStatus;

/** Requête refusée (partie inconnue ou expirée, case ou chiffre invalide, difficulté inconnue) : 400. */
public class SudokuBadRequestException extends ApiException {
    public SudokuBadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
