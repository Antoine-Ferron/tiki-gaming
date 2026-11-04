package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JSON;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JWT_SECRET;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.props;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.saved;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class SealedStateTest {

    private final SealedState sealer = new SealedState(props(JWT_SECRET), JSON);

    @Test
    void aSealedGameIsReadBackIdentically() {
        // Étant donné une partie enregistrée
        SavedGame game = saved(3);

        // Quand le serveur la scelle puis la relit
        // Alors il retrouve exactement la même partie, mains des IA comprises
        assertThat(sealer.unseal(sealer.seal(game))).contains(game);
    }

    @Test
    void theSealedGameRevealsNothingToThePlayer() {
        // Quand le serveur scelle une partie (le joueur peut lire sa ligne de game_saves)
        String sealed = sealer.seal(saved(1));

        // Alors on n'y lit ni les cartes ni les joueurs, et deux sceaux de la même partie diffèrent
        String bytes = new String(Base64.getDecoder().decode(sealed));
        assertThat(bytes).doesNotContain("IA 1", "Chantier", "hands");
        assertThat(sealer.seal(saved(1))).isNotEqualTo(sealed);
    }

    @Test
    void aTamperedOrForeignSealIsRejected() {
        // Étant donné une partie scellée
        String sealed = sealer.seal(saved(1));
        byte[] tampered = Base64.getDecoder().decode(sealed);
        tampered[tampered.length - 1] ^= 1;

        // Quand le joueur modifie un octet, ou que le sceau vient d'un autre secret, ou n'est pas un sceau
        // Alors la partie est ignorée plutôt que chargée
        assertThat(sealer.unseal(Base64.getEncoder().encodeToString(tampered))).isEmpty();
        assertThat(new SealedState(props("another-secret-with-at-least-32-characters"), JSON).unseal(sealed))
                .isEmpty();
        assertThat(sealer.unseal("pas un sceau")).isEmpty();
    }
}
