package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JSON;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JWT_SECRET;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.props;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.saved;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

class SessionGameStoreTest {

    // Fake : session HTTP en mémoire fournie par Spring ; vrai sceau (chiffrement) de la partie.
    private static final SealedState SEALER = new SealedState(props(JWT_SECRET), JSON);
    private final MockHttpSession session = new MockHttpSession();

    @Test
    void theSessionOnlyHoldsTheSealedGameAsText() {
        // Quand un invité enregistre sa partie
        new SessionGameStore(session, SEALER).save(saved(1), 0);

        // Alors la session ne garde qu'un texte scellé : sérialisable (session persistée ou répliquée),
        // et sans les mains des IA en clair
        assertThat(session.getAttribute(SessionGameStore.ATTRIBUTE))
                .isInstanceOfSatisfying(String.class, text -> assertThat(text).doesNotContain("IA 1"));
    }

    @Test
    void aGuestGameLivesInItsSessionAcrossRequests() {
        // Étant donné un invité qui commence une partie
        new SessionGameStore(session, SEALER).save(saved(1), 0);

        // Quand il revient avec la même session (nouvelle requête)
        // Alors il retrouve sa partie, et peut enregistrer le tour suivant
        SessionGameStore again = new SessionGameStore(session, SEALER);
        assertThat(again.load()).contains(saved(1));
        again.save(saved(2), 1);
        assertThat(again.load()).contains(saved(2));
    }

    @Test
    void anOutdatedSaveIsRefusedAndClearingForgetsTheGame() {
        // Étant donné une partie de l'invité en version 2
        SessionGameStore store = new SessionGameStore(session, SEALER);
        store.save(saved(2), 0);

        // Quand un enregistrement arrive pour la version 1
        // Alors il est refusé
        assertThatThrownBy(() -> store.save(saved(2), 1)).isInstanceOf(StaleGameException.class);
        // Et une fois effacée, la partie n'existe plus, ni dans une autre session
        store.clear();
        assertThat(store.load()).isEmpty();
        assertThat(new SessionGameStore(new MockHttpSession(), SEALER).load()).isEmpty();
    }

    @Test
    void aNewGameReplacesTheGuestGameInProgress() {
        // Étant donné un invité dont la partie en cours est en version 3
        SessionGameStore store = new SessionGameStore(session, SEALER);
        store.save(saved(3), 0);

        // Quand il commence une nouvelle partie (version attendue 0 : remplacer la partie, quelle qu'elle soit)
        store.save(saved(1), 0);

        // Alors la nouvelle partie remplace l'ancienne
        assertThat(store.load()).contains(saved(1));
    }
}
