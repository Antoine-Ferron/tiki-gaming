package fr.tikigaming.games.sdv_civilisation.api;

/** La partie enregistrée a changé depuis sa lecture (autre onglet, double envoi). */
public class StaleGameException extends RuntimeException {

    public StaleGameException() {
        super("La partie a changé entre-temps");
    }
}
