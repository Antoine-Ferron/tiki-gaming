package fr.tikigaming.games.mini_gta.progress;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.missions.Pos;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Propriétés des règles d'argent vérifiées sur des progressions générées (fuzzing déterministe : graine fixe, donc
 * un échec se rejoue à l'identique), en complément des valeurs limites de {@link TransactionsTest}.
 */
@DisplayName("Transactions : invariants sur des progressions générées")
class TransactionsPropertyTest {

    private static final int RUNS = 2_000;

    private static Progress randomProgress(Random random) {
        return Progress.initial()
                .withMoney(random.nextInt(20_000))
                .earn(random.nextInt(50_000))
                .withMoney(random.nextInt(20_000));
    }

    @Test
    void unAchatNePasseQueSiLeSoldeCouvreLePrixEtNeToucheJamaisAuScore() {
        Random random = new Random(0x5EED);
        Purchase.Item[] items = Purchase.Item.values();
        WeaponId[] weapons = WeaponId.values();
        for (int i = 0; i < RUNS; i++) {
            Progress before = randomProgress(random);
            Purchase.Item item = items[random.nextInt(items.length)];
            WeaponId weapon = weapons[random.nextInt(weapons.length)];
            if (!Transactions.sells(item, weapon)) continue;

            Purchase p = Transactions.purchase(before, item, weapon);

            assertThat(p.ok()).isEqualTo(before.money() >= p.price());
            assertThat(p.progress().money()).isEqualTo(p.ok() ? before.money() - p.price() : before.money());
            assertThat(p.progress().totalEarned()).isEqualTo(before.totalEarned());
            if (!p.ok()) assertThat(p.rounds()).isZero();
        }
    }

    @Test
    void uneReapparitionCouteAuMoinsLeMinimumSansJamaisLaisserDeDette() {
        Random random = new Random(0x5EED);
        for (int i = 0; i < RUNS; i++) {
            Progress before = randomProgress(random);
            Respawn.Reason reason = random.nextBoolean() ? Respawn.Reason.DEAD : Respawn.Reason.BUSTED;

            Respawn r = Transactions.respawn(before, reason);

            assertThat(r.fee()).isGreaterThanOrEqualTo(reason == Respawn.Reason.DEAD ? 100 : 200);
            assertThat(r.progress().money()).isEqualTo(Math.max(0, before.money() - r.fee()));
            assertThat(r.progress().totalEarned()).isEqualTo(before.totalEarned());
        }
    }

    @Test
    void uneMissionPaieUneSeuleFoisEtLeScoreMonteDeSaRecompense() {
        Random random = new Random(0x5EED);
        for (int i = 0; i < RUNS; i++) {
            Progress before = randomProgress(random);
            MissionDef mission = new MissionDef(
                    "m" + random.nextInt(4), "", "", 1 + random.nextInt(5_000), new Pos(0, 0), List.of());

            MissionReward first = Transactions.completeMission(before, mission);
            MissionReward again = Transactions.completeMission(first.progress(), mission);

            assertThat(first.progress().totalEarned()).isEqualTo(before.totalEarned() + mission.reward());
            assertThat(first.progress().money()).isEqualTo(before.money() + mission.reward());
            assertThat(again.rewarded()).isFalse();
            assertThat(again.progress()).isEqualTo(first.progress());
        }
    }
}
