package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.saved;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

class SessionGameStoreTest {

    // Fake : session HTTP en mémoire fournie par Spring.
    private final MockHttpSession session = new MockHttpSession();

    @Test
    void aGuestGameLivesInItsSessionAcrossRequests() {
        // Étant donné un invité qui commence une partie
        new SessionGameStore(session).save(saved(1), 0);

        // Quand il revient avec la même session (nouvelle requête)
        // Alors il retrouve sa partie, et peut enregistrer le tour suivant
        SessionGameStore again = new SessionGameStore(session);
        assertThat(again.load()).contains(saved(1));
        again.save(saved(2), 1);
        assertThat(again.load()).contains(saved(2));
    }

    @Test
    void anOutdatedSaveIsRefusedAndClearingForgetsTheGame() {
        // Étant donné une partie de l'invité en version 2
        SessionGameStore store = new SessionGameStore(session);
        store.save(saved(2), 0);

        // Quand un enregistrement arrive pour la version 1
        // Alors il est refusé
        assertThatThrownBy(() -> store.save(saved(2), 1)).isInstanceOf(StaleGameException.class);
        // Et une fois effacée, la partie n'existe plus, ni dans une autre session
        store.clear();
        assertThat(store.load()).isEmpty();
        assertThat(new SessionGameStore(new MockHttpSession()).load()).isEmpty();
    }
}
