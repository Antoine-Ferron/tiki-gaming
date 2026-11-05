package fr.tikigaming.games.mini_gta.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.missions.Pos;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("Transactions : règles d'argent, sans état")
class TransactionsTest {

    private static final MissionDef PORT =
            new MissionDef("port", "Contrat au port", "", 2500, new Pos(0, 0), List.of());

    private static Progress withMoney(int money) {
        return Progress.initial().withMoney(money);
    }

    @Test
    void unePartieNeuveCommenceAvec500DollarsEtRienDeGagne() {
        Progress p = Progress.initial();

        assertThat(p.version()).isEqualTo(1);
        assertThat(p.money()).isEqualTo(500);
        assertThat(p.totalEarned()).isZero();
        assertThat(p.inventory()).isNull();
        assertThat(p.completedMissions()).isEmpty();
    }

    @Nested
    class Missions {
        @Test
        void reussirUneMissionPaieLaRecompenseEtLaCompteDansLesGains() {
            MissionReward r = Transactions.completeMission(Progress.initial(), PORT);

            assertThat(r.rewarded()).isTrue();
            assertThat(r.reward()).isEqualTo(2500);
            assertThat(r.progress().money()).isEqualTo(3000);
            assertThat(r.progress().totalEarned()).isEqualTo(2500);
            assertThat(r.progress().completedMissions()).containsExactly("port");
        }

        @Test
        void uneMissionNePaieQuUneFois() {
            Progress done =
                    Transactions.completeMission(Progress.initial(), PORT).progress();

            MissionReward again = Transactions.completeMission(done, PORT);

            assertThat(again.rewarded()).isFalse();
            assertThat(again.reward()).isZero();
            assertThat(again.progress()).isEqualTo(done);
        }

        @ParameterizedTest(name = "{0} $ déjà gagnés + 2500 $ → score {1} $")
        @CsvSource({"997499, 999999", "997500, 1000000", "997501, 1000000", "1000000, 1000000"})
        void lesGainsCumulesSArretentAuPlafondDuScore(int earned, int score) {
            Progress p = new Progress(1, 500, earned, 0, null, List.of(), new Progress.Stats(0, 0, 0));

            MissionReward r = Transactions.completeMission(p, PORT);

            assertThat(r.reward()).isEqualTo(2500);
            assertThat(r.progress().money()).isEqualTo(3000);
            assertThat(r.progress().totalEarned()).isEqualTo(score);
        }
    }

    @Nested
    class Armurerie {
        @Test
        void acheterUneArmeDebiteEtDonneDeuxChargeurs() {
            Purchase p = Transactions.purchase(withMoney(1500), Purchase.Item.WEAPON, WeaponId.RIFLE);

            assertThat(p.ok()).isTrue();
            assertThat(p.rounds()).isEqualTo(60);
            assertThat(p.progress().money()).isZero();
        }

        @Test
        void lesDepensesNeDiminuentPasLesGains() {
            Progress p = Progress.initial().earn(1000);

            Purchase bought = Transactions.purchase(p, Purchase.Item.ARMOR, null);

            assertThat(bought.progress().money()).isEqualTo(1250);
            assertThat(bought.progress().totalEarned()).isEqualTo(1000);
        }

        @Test
        void lesGrenadesSAchetentParPaquet() {
            Purchase p = Transactions.purchase(withMoney(500), Purchase.Item.WEAPON, WeaponId.GRENADE);

            assertThat(p.rounds()).isEqualTo(5);
            assertThat(p.progress().money()).isEqualTo(100);
        }

        @Test
        void acheterDesMunitions() {
            Purchase p = Transactions.purchase(withMoney(500), Purchase.Item.AMMO, WeaponId.PISTOL);

            assertThat(p.rounds()).isEqualTo(36);
            assertThat(p.price()).isEqualTo(60);
            assertThat(p.progress().money()).isEqualTo(440);
        }

        @Test
        void acheterUnGiletPareBalles() {
            Purchase p = Transactions.purchase(withMoney(500), Purchase.Item.ARMOR, null);

            assertThat(p.ok()).isTrue();
            assertThat(p.price()).isEqualTo(250);
            assertThat(p.rounds()).isZero();
            assertThat(p.progress().money()).isEqualTo(250);
        }

        @ParameterizedTest(name = "solde {0} $ pour un pistolet à 300 $ -> accepté : {1}")
        @CsvSource({"299, false", "300, true", "301, true"})
        void leSoldeDoitCouvrirLePrix(int money, boolean ok) {
            Purchase p = Transactions.purchase(withMoney(money), Purchase.Item.WEAPON, WeaponId.PISTOL);

            assertThat(p.ok()).isEqualTo(ok);
            assertThat(p.price()).isEqualTo(300);
            assertThat(p.rounds()).isEqualTo(ok ? 24 : 0);
            assertThat(p.progress().money()).isEqualTo(ok ? money - 300 : money);
        }

        @ParameterizedTest(name = "{0} {1} -> vendu : {2}")
        @CsvSource({
            "ARMOR, , true",
            "WEAPON, PISTOL, true",
            "AMMO, PISTOL, true",
            "WEAPON, BAT, true",
            "WEAPON, , false",
            "AMMO, , false",
            "WEAPON, FISTS, false",
            "AMMO, FISTS, false",
            "AMMO, BAT, false"
        })
        void ceQuiSeVend(Purchase.Item item, WeaponId weapon, boolean sold) {
            assertThat(Transactions.sells(item, weapon)).isEqualTo(sold);
        }

        @Test
        void acheterCeQuiNeSeVendPasEstRefuse() {
            assertThatThrownBy(() -> Transactions.purchase(withMoney(500), Purchase.Item.AMMO, WeaponId.BAT))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("réapparition : frais (valeurs limites)")
    class Reapparition {
        @ParameterizedTest(name = "mort avec {0} $ -> frais {1} $")
        @CsvSource({"0, 100", "994, 100", "995, 100", "1004, 100", "1005, 101", "5000, 500"})
        void fraisDHopital(int money, int fee) {
            assertThat(Transactions.respawn(withMoney(money), Respawn.Reason.DEAD)
                            .fee())
                    .isEqualTo(fee);
        }

        @ParameterizedTest(name = "arrêté avec {0} $ -> caution {1} $")
        @CsvSource({"0, 200", "1336, 200", "1337, 201", "10000, 1500"})
        void caution(int money, int fee) {
            assertThat(Transactions.respawn(withMoney(money), Respawn.Reason.BUSTED)
                            .fee())
                    .isEqualTo(fee);
        }

        @Test
        void lesFraisSontDebites() {
            Respawn r = Transactions.respawn(withMoney(5000).earn(0), Respawn.Reason.DEAD);

            assertThat(r.progress().money()).isEqualTo(4500);
        }

        @Test
        void lesFraisNeRendentJamaisLeSoldeNegatif() {
            assertThat(Transactions.respawn(withMoney(50), Respawn.Reason.BUSTED)
                            .progress()
                            .money())
                    .isZero();
        }
    }
}
