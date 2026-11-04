package fr.tikigaming.games.mini_gta.features;

import static org.assertj.core.api.Assertions.assertThat;

import io.cucumber.java.ParameterType;
import io.cucumber.java.fr.Alors;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Client de l'API MiniGTA partagé par les étapes d'un scénario (une instance par scénario) : il garde la
 * dernière réponse, que les étapes « Alors » vérifient.
 */
public class MiniGtaApi {

    static final String BASE = "/api/games/mini-gta";
    static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String XSRF = "jeton-de-test";

    private final MockMvc mvc;
    private int status;
    private JsonNode body;

    public MiniGtaApi(MockMvc mvc) {
        this.mvc = mvc;
    }

    JsonNode get(String path) {
        return send(MockMvcRequestBuilders.get(BASE + path));
    }

    /** POST tel que l'envoie le front : cookie XSRF-TOKEN recopié dans l'en-tête X-XSRF-TOKEN. */
    JsonNode post(String path, Object payload) {
        return send(MockMvcRequestBuilders.post(BASE + path)
                .cookie(new Cookie("XSRF-TOKEN", XSRF))
                .header("X-XSRF-TOKEN", XSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(payload)));
    }

    private JsonNode send(MockHttpServletRequestBuilder request) {
        try {
            MvcResult result = mvc.perform(request).andReturn();
            status = result.getResponse().getStatus();
            String content = result.getResponse().getContentAsString();
            body = content.isEmpty() ? null : JSON.readTree(content);
            return body;
        } catch (Exception e) {
            throw new IllegalStateException("Requête impossible : " + e.getMessage(), e);
        }
    }

    boolean succeeded() {
        return status == 200;
    }

    /** Montant en dollars, écrit comme dans le jeu : « 500 $ ». */
    @ParameterType(name = "montant", value = "(\\d+) \\$")
    public int montant(String dollars) {
        return Integer.parseInt(dollars);
    }

    /**
     * Le gestionnaire d'erreurs de la plateforme donne le même message à toute requête refusée par le contrôleur
     * (« Requête invalide. ») : seul le code distingue une mission introuvable d'une saisie invalide.
     */
    @Alors("la demande est refusée avec le code {int}")
    public void laDemandeEstRefusee(int code) {
        assertThat(status).isEqualTo(code);
        assertThat(body.get("error").asString()).isEqualTo("Requête invalide.");
    }
}
