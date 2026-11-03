package fr.tikigaming.games.mini_gta.api;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Arbre JSON d'une valeur, tel que Jackson l'écrira dans la réponse HTTP. */
final class JsonTrees {
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private JsonTrees() {}

    static JsonNode tree(Object value) {
        return MAPPER.valueToTree(value);
    }
}
