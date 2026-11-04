package fr.tikigaming.games.sdv_civilisation.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.tikigaming.games.sdv_civilisation.Card;
import fr.tikigaming.games.sdv_civilisation.CurrencyConverter;
import fr.tikigaming.games.sdv_civilisation.Engine;
import fr.tikigaming.games.sdv_civilisation.GameState;
import fr.tikigaming.games.sdv_civilisation.Payment;
import fr.tikigaming.games.sdv_civilisation.Payments;
import fr.tikigaming.games.sdv_civilisation.PlayerState;
import fr.tikigaming.games.sdv_civilisation.Ranked;
import fr.tikigaming.games.sdv_civilisation.Refusal;
import fr.tikigaming.games.sdv_civilisation.ResourceNeed;
import fr.tikigaming.games.sdv_civilisation.Scoring;
import fr.tikigaming.games.sdv_civilisation.TurnEvent;
import java.util.List;

/**
 * Ce que le joueur a le droit de voir de sa partie : sa main (chaque carte avec son prix), les cités de la table,
 * le nombre de cartes défaussées et ce que chacun a joué au dernier tour. Jamais les mains des IA.
 *
 * @param remainingMs temps restant pour jouer ce tour (le front affiche le compte à rebours)
 * @param passesLeft sens de passage des mains à cet âge
 * @param conflicts jetons gagnés ou perdus par chacun aux conflits de l'âge qui vient de se terminer
 * @param ranking classement final, une fois la partie terminée
 */
public record GameView(
        int version,
        int age,
        int turn,
        boolean over,
        boolean passesLeft,
        long remainingMs,
        List<PlayerState> players,
        List<HandCard> hand,
        Payment wonder,
        List<ResourceNeed> wonderNeeds,
        int discards,
        List<TurnEvent> lastTurn,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Integer> conflicts,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Ranked> ranking) {

    /** Une carte de la main : son prix de construction et, sauf chaîne ou carte déjà construite, ses ressources. */
    public record HandCard(Card card, Payment build, List<ResourceNeed> needs) {}

    static GameView of(SavedGame saved, long now, CurrencyConverter converter) {
        GameState state = saved.state();
        int me = Engine.PLAYER;
        List<HandCard> hand = state.hands().get(me).stream()
                .map(card -> {
                    Payment build = Payments.build(state, me, card, converter);
                    boolean costless = build.chain() || build.refusal() == Refusal.BUILT;
                    return new HandCard(card, build, costless ? List.of() : Payments.breakdown(state, me, card.cost()));
                })
                .toList();
        return new GameView(
                saved.version(),
                state.age(),
                state.turn(),
                state.over(),
                Engine.passesLeft(state.age()),
                state.over() ? 0 : Math.max(0, saved.deadline() - now),
                state.players(),
                hand,
                Payments.wonder(state, me, converter),
                Payments.wonderNeeds(state, me),
                state.discards().size(),
                state.lastTurn(),
                state.conflicts(),
                state.over() ? Scoring.ranking(state) : List.of());
    }
}
