package fr.tikigaming.games.sdv_civilisation;

/** Coup ou demande refusés par les règles du jeu ; le message s'adresse au joueur. */
public class GameRuleException extends RuntimeException {

    public GameRuleException(String message) {
        super(message);
    }
}
