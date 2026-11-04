package fr.tikigaming.games.sdv_civilisation.api;

import jakarta.servlet.http.HttpSession;
import java.util.Optional;

/**
 * Partie d'un invité : gardée dans sa session HTTP, côté serveur. Elle se reprend tant que la session vit
 * (navigateur ouvert, 7 jours au plus) ; elle n'est jamais enregistrée en base.
 */
public class SessionGameStore implements GameStore {

    static final String ATTRIBUTE = "sdv-civilisation.game";

    private final HttpSession session;

    public SessionGameStore(HttpSession session) {
        this.session = session;
    }

    @Override
    public Optional<SavedGame> load() {
        return Optional.ofNullable((SavedGame) session.getAttribute(ATTRIBUTE));
    }

    @Override
    public void save(SavedGame game, int expectedVersion) {
        synchronized (session) {
            int current = load().map(SavedGame::version).orElse(0);
            if (expectedVersion != 0 && expectedVersion != current) throw new StaleGameException();
            session.setAttribute(ATTRIBUTE, game);
        }
    }

    @Override
    public void clear() {
        session.removeAttribute(ATTRIBUTE);
    }
}
