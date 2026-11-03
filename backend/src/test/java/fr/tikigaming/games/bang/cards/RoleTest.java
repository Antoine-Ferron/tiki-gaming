package fr.tikigaming.games.bang.cards;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

class RoleTest {

    @Test
    void thereAreExactlyFourRoleCards() {
        assertThat(Role.values()).containsExactly(Role.SHERIFF, Role.DEPUTY, Role.OUTLAW, Role.RENEGADE);
    }

    @ParameterizedTest
    @CsvSource({"SHERIFF, Shérif", "DEPUTY, Adjoint", "OUTLAW, Hors-la-loi", "RENEGADE, Renégat"})
    void eachRoleCardHasItsName(Role role, String name) {
        assertThat(role.label()).isEqualTo(name);
    }

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            value = {
                "SHERIFF  | Doit éliminer tous les hors-la-loi et le Renégat pour faire régner la loi.",
                "DEPUTY   | Aident et protègent le Shérif. Ils ont le même but que lui et ils l'accompliront coûte que coûte.",
                "OUTLAW   | Ont envie de tuer le Shérif, mais ils n'ont aucun scrupule à s'entretuer pour ramasser les récompenses.",
                "RENEGADE | Veut prendre la place du Shérif : son but est d'être le dernier personnage en jeu."
            })
    void eachRoleCardStatesItsGoal(Role role, String goal) {
        assertThat(role.goal()).isEqualTo(goal);
    }

    @Test
    void faceDownCardsAllShowTheSameBackAndRevealNothing() {
        var faces = Arrays.stream(Role.values())
                .map(role -> new RoleCard(role, false).face())
                .distinct()
                .toList();

        assertThat(faces).containsExactly(RoleCard.BACK);
        assertThat(RoleCard.BACK.name()).isEmpty();
        assertThat(RoleCard.BACK.goal()).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(Role.class)
    void faceUpCardShowsItsNameAndGoal(Role role) {
        RoleCard.Face face = new RoleCard(role, true).face();

        assertThat(face).isEqualTo(new RoleCard.Face(role.label(), role.goal()));
    }

    @Test
    void revealTurnsTheCardFaceUpWithoutChangingTheOriginal() {
        RoleCard hidden = new RoleCard(Role.RENEGADE, false);

        RoleCard revealed = hidden.reveal();

        assertThat(revealed.faceUp()).isTrue();
        assertThat(revealed.role()).isEqualTo(Role.RENEGADE);
        assertThat(hidden.faceUp()).isFalse();
    }
}
