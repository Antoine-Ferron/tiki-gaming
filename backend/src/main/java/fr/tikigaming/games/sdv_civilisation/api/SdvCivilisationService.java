package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.games.sdv_civilisation.Action;
import fr.tikigaming.games.sdv_civilisation.ActionType;
import fr.tikigaming.games.sdv_civilisation.Card;
import fr.tikigaming.games.sdv_civilisation.Clock;
import fr.tikigaming.games.sdv_civilisation.CurrencyConverter;
import fr.tikigaming.games.sdv_civilisation.Engine;
import fr.tikigaming.games.sdv_civilisation.GameRuleException;
import fr.tikigaming.games.sdv_civilisation.GameState;
import fr.tikigaming.games.sdv_civilisation.Scoring;
import fr.tikigaming.games.sdv_civilisation.TurnPhase;
import fr.tikigaming.games.sdv_civilisation.TurnTimer;
import fr.tikigaming.games.sdv_civilisation.Wonders;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Arbitre de la partie : charge la partie du joueur, rattrape un tour expiré, vérifie et joue son coup, enregistre
 * le tour suivant, puis le score final d'un joueur connecté. {@code userId} vaut {@code null} pour un invité.
 */
@Service
public class SdvCivilisationService {

    static final String PLAYER_NAME = "Toi";
    static final String STALE = "La partie a avancé entre-temps : voici le tour en cours.";
    static final String EXPIRED = "Temps écoulé : une carte de ta main a été défaussée au hasard.";
    static final String NOT_IN_HAND = "Cette carte n'est pas dans ta main.";
    static final String OVER = "La partie est terminée.";

    private final Engine engine;
    private final CurrencyConverter converter;
    private final Clock clock;
    private final ScoreRecorder scores;

    public SdvCivilisationService(Engine engine, CurrencyConverter converter, Clock clock, ScoreRecorder scores) {
        this.engine = engine;
        this.converter = converter;
        this.clock = clock;
        this.scores = scores;
    }

    /** Partie à reprendre, s'il y en a une. */
    public Optional<GameView> current(GameStore store, String userId) {
        return store.load().map(saved -> view(catchUp(store, saved, userId)));
    }

    /** Nouvelle partie avec la merveille choisie ; remplace la partie en cours (abandonnée). */
    public GameView start(GameStore store, String wonder) {
        GameState state = engine.create(PLAYER_NAME, Wonders.byName(wonder));
        SavedGame saved = new SavedGame(1, TurnTimer.start(clock).deadline(), state);
        store.save(saved, 0);
        return view(saved);
    }

    /**
     * Joue la carte en position {@code card} de la main.
     *
     * @throws GameConflictException si le tour a expiré ou si {@code version} n'est plus celle de la partie
     * @throws GameRuleException si le coup est interdit
     */
    public GameView play(GameStore store, String userId, int card, ActionType type, int version) {
        SavedGame saved = store.load().orElseThrow(NoGameException::new);
        if (expired(saved)) throw new GameConflictException(EXPIRED, view(catchUp(store, saved, userId)));
        if (saved.version() != version) throw new GameConflictException(STALE, view(saved));
        if (saved.state().over()) throw new GameRuleException(OVER);
        List<Card> hand = saved.state().hands().get(Engine.PLAYER);
        if (card < 0 || card >= hand.size()) throw new GameRuleException(NOT_IN_HAND);
        GameState next = engine.playAgainstAis(
                saved.state(), new Action(type, hand.get(card).name()));
        return view(advance(store, saved, next, userId));
    }

    public void abandon(GameStore store) {
        store.clear();
    }

    private boolean expired(SavedGame saved) {
        return !saved.state().over()
                && TurnTimer.resume(clock, saved.deadline()).phase() == TurnPhase.EXPIRED;
    }

    /** Le joueur a laissé expirer son tour (même onglet fermé) : sa carte est défaussée au hasard, une fois. */
    private SavedGame catchUp(GameStore store, SavedGame saved, String userId) {
        if (!expired(saved)) return saved;
        return advance(store, saved, engine.timeOut(saved.state(), saved.deadline()), userId);
    }

    private SavedGame advance(GameStore store, SavedGame saved, GameState next, String userId) {
        SavedGame updated =
                new SavedGame(saved.version() + 1, TurnTimer.start(clock).deadline(), next);
        try {
            store.save(updated, saved.version());
        } catch (StaleGameException e) {
            throw new GameConflictException(STALE, view(store.load().orElseThrow(NoGameException::new)));
        }
        if (next.over() && userId != null) scores.record(userId, Scoring.finalScore(next, Engine.PLAYER));
        return updated;
    }

    private GameView view(SavedGame saved) {
        return GameView.of(saved, clock.now(), converter);
    }
}
