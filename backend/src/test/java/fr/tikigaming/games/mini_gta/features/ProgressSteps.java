package fr.tikigaming.games.mini_gta.features;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.mini_gta.progress.Progress;
import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Étapes des règles d'argent (missions, armurerie, réapparition, score). Comme le front, chaque étape envoie la
 * progression reçue à la réponse précédente : le serveur ne garde rien entre deux requêtes. Les noms du joueur
 * (« Colis express », « fusil à pompe ») ne sont traduits en identifiants de l'API qu'ici.
 */
public class ProgressSteps {

    /** Missions, par le nom affiché au joueur (docs/games/mini-gta/regles.md, R3). */
    private static final Map<String, String> MISSIONS = Map.of(
            "Colis express", "express",
            "La fuite", "chase",
            "Contrat au port", "port",
            "Commande spéciale", "special",
            "Braquage de banque", "braquage");

    /** Armes, par le nom affiché à l'armurerie. */
    private static final Map<String, String> WEAPONS = Map.of(
            "poings", "fists",
            "batte", "bat",
            "pistolet", "pistol",
            "grenades", "grenade",
            "fusil à pompe", "shotgun",
            "fusil d'assaut", "rifle",
            "sniper", "sniper");

    private ObjectNode progress;
    private JsonNode result;

    private static String id(Map<String, String> names, String name) {
        assertThat(names).as("nom inconnu des scénarios").containsKey(name);
        return names.get(name);
    }

    @Etantdonné("une nouvelle partie")
    public void uneNouvellePartie() {
        progress = (ObjectNode) MiniGtaApi.JSON.valueToTree(Progress.initial());
    }

    @Etantdonné("un joueur qui a {montant}")
    public void unJoueurQuiA(int money) {
        uneNouvellePartie();
        progress.put("money", money);
    }

    /** Envoie la progression courante ; la garde à jour si la requête réussit. */
    private void transaction(String path, Map<String, Object> fields) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("progress", progress);
        payload.putAll(fields);
        result = MiniGtaApi.post(path, payload);
        if (MiniGtaApi.succeeded()) progress = (ObjectNode) result.get("progress");
    }

    @Quand("il réussit la mission {string}")
    @Etantdonné("il a réussi la mission {string}")
    public void ilReussitLaMission(String mission) {
        transaction("/missions/" + id(MISSIONS, mission) + "/complete", Map.of());
    }

    @Etantdonné("il a réussi les missions {string} et {string}")
    public void ilAReussiLesMissions(String first, String second) {
        ilReussitLaMission(first);
        ilReussitLaMission(second);
    }

    @Quand("il achète l'arme {string}")
    @Et("il a acheté l'arme {string}")
    public void ilAcheteLArme(String weapon) {
        transaction("/shop/purchase", Map.of("item", "weapon", "weapon", id(WEAPONS, weapon)));
    }

    @Quand("il achète des munitions pour l'arme {string}")
    public void ilAcheteDesMunitions(String weapon) {
        transaction("/shop/purchase", Map.of("item", "ammo", "weapon", id(WEAPONS, weapon)));
    }

    @Quand("il achète le gilet")
    public void ilAcheteLeGilet() {
        transaction("/shop/purchase", Map.of("item", "armor"));
    }

    @Quand("il demande l'arme {string}")
    public void ilDemandeLArme(String weapon) {
        ilAcheteLArme(weapon);
    }

    @Quand("il demande des munitions pour les {string}")
    @Et("il demande des munitions pour la {string}")
    public void ilDemandeDesMunitions(String weapon) {
        ilAcheteDesMunitions(weapon);
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

    @Alors("la mission est introuvable")
    public void laMissionEstIntrouvable() {
        MiniGtaApi.assertRefused(404);
    }

    @Et("la mission {string} est terminée")
    public void laMissionEstTerminee(String mission) {
        assertThat(progress.get("completedMissions").valueStream().map(JsonNode::asString))
                .containsOnlyOnce(id(MISSIONS, mission));
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

    @Alors("l'armurerie répond que l'article n'est pas vendu")
    public void lArticleNEstPasVendu() {
        MiniGtaApi.assertRefused(400);
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
