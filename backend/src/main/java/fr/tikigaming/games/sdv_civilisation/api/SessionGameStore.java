package fr.tikigaming.games.sdv_civilisation.api;

import jakarta.servlet.http.HttpSession;
import java.util.Optional;

/**
 * Partie d'un invité : gardée dans sa session HTTP, côté serveur. Elle se reprend tant que la session vit
 * (navigateur ouvert, 7 jours au plus) ; elle n'est jamais enregistrée en base. La session ne garde que la partie
 * scellée, un simple texte : sérialisable si la session est persistée ou répliquée entre serveurs.
 */
public class SessionGameStore implements GameStore {

    static final String ATTRIBUTE = "sdv-civilisation.game";

    private final HttpSession session;
    private final SealedState sealer;

    public SessionGameStore(HttpSession session, SealedState sealer) {
        this.session = session;
        this.sealer = sealer;
    }

    @Override
    public Optional<SavedGame> load() {
        return Optional.ofNullable((String) session.getAttribute(ATTRIBUTE)).flatMap(sealer::unseal);
    }

    @Override
    public void save(SavedGame game, int expectedVersion) {
        synchronized (session) {
            int current = load().map(SavedGame::version).orElse(0);
            if (expectedVersion != 0 && expectedVersion != current) throw new StaleGameException();
            session.setAttribute(ATTRIBUTE, sealer.seal(game));
        }
    }

    @Override
    public void clear() {
        session.removeAttribute(ATTRIBUTE);
    }
}
