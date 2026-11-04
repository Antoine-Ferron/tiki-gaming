package fr.tikigaming.games.mini_gta.features;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.mini_gta.progress.Progress;
import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;
import io.cucumber.java.fr.Soit;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Étapes des règles d'argent (missions, armurerie, réapparition, score). Comme le front, chaque étape envoie la
 * progression reçue à la réponse précédente : le serveur ne garde rien entre deux requêtes.
 */
public class ProgressSteps {

    private final MiniGtaApi api;
    private ObjectNode progress = (ObjectNode) MiniGtaApi.JSON.valueToTree(Progress.initial());
    private JsonNode result;

    public ProgressSteps(MiniGtaApi api) {
        this.api = api;
    }

    @Soit("une nouvelle partie")
    public void uneNouvellePartie() {
        progress = (ObjectNode) MiniGtaApi.JSON.valueToTree(Progress.initial());
    }

    @Etantdonné("un joueur qui a {montant}")
    public void unJoueurQuiA(int money) {
        progress.put("money", money);
    }

    /** Envoie la progression courante ; la garde à jour si la requête réussit. */
    private void transaction(String path, Map<String, Object> fields) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("progress", progress);
        payload.putAll(fields);
        result = api.post(path, payload);
        if (api.succeeded()) progress = (ObjectNode) result.get("progress");
    }

    @Quand("il réussit la mission {string}")
    @Etantdonné("il a réussi la mission {string}")
    public void ilReussitLaMission(String mission) {
        transaction("/missions/" + mission + "/complete", Map.of());
    }

    @Quand("il achète l'arme {string}")
    public void ilAcheteLArme(String weapon) {
        transaction("/shop/purchase", Map.of("item", "weapon", "weapon", weapon));
    }

    @Quand("il achète des munitions pour l'arme {string}")
    public void ilAcheteDesMunitions(String weapon) {
        transaction("/shop/purchase", Map.of("item", "ammo", "weapon", weapon));
    }

    @Quand("il achète le gilet")
    public void ilAcheteLeGilet() {
        transaction("/shop/purchase", Map.of("item", "armor"));
    }

    @Quand("il demande l'article {string} pour l'arme {string}")
    public void ilDemandeLArticle(String item, String weapon) {
        transaction("/shop/purchase", Map.of("item", item, "weapon", weapon));
    }

    @Quand("il meurt")
    public void ilMeurt() {
        transaction("/respawn", Map.of("reason", "dead"));
    }

    @Quand("il est arrêté")
    public void ilEstArrete() {
        transaction("/respawn", Map.of("reason", "busted"));
    }

    @Alors("la mission lui rapporte {montant}")
    public void laMissionLuiRapporte(int reward) {
        assertThat(result.get("rewarded").asBoolean()).isTrue();
        assertThat(result.get("reward").asInt()).isEqualTo(reward);
    }

    @Alors("la mission ne lui rapporte rien")
    public void laMissionNeLuiRapporteRien() {
        assertThat(result.get("rewarded").asBoolean()).isFalse();
        assertThat(result.get("reward").asInt()).isZero();
    }

    @Et("la mission {string} est terminée")
    public void laMissionEstTerminee(String mission) {
        assertThat(progress.get("completedMissions").valueStream().map(JsonNode::asString))
                .containsOnlyOnce(mission);
    }

    @Alors("l'achat est accepté au prix de {montant}")
    public void lAchatEstAccepteAuPrixDe(int price) {
        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(result.get("price").asInt()).isEqualTo(price);
    }

    @Alors("l'achat est {word}")
    public void lAchatEst(String outcome) {
        assertThat(outcome).isIn("accepté", "refusé");
        assertThat(result.get("ok").asBoolean()).isEqualTo(outcome.equals("accepté"));
    }

    @Et("il reçoit {int} munitions")
    public void ilRecoitDesMunitions(int rounds) {
        assertThat(result.get("rounds").asInt()).isEqualTo(rounds);
    }

    @Alors("il paie {montant}")
    public void ilPaie(int fee) {
        assertThat(result.get("fee").asInt()).isEqualTo(fee);
    }

    @Et("son solde est de {montant}")
    public void sonSoldeEstDe(int money) {
        assertThat(progress.get("money").asInt()).isEqualTo(money);
    }

    @Et("son score est de {montant}")
    public void sonScoreEstDe(int totalEarned) {
        assertThat(progress.get("totalEarned").asInt()).isEqualTo(totalEarned);
    }
}
