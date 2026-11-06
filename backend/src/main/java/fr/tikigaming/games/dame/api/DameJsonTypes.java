package fr.tikigaming.games.dame.api;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** Désérialisation stricte limitée aux requêtes Dames, sans modifier Jackson pour les autres jeux. */
public final class DameJsonTypes {

    private DameJsonTypes() {}

    public static final class IntegerValue extends ValueDeserializer<Integer> {
        @Override
        public Integer deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
                return (Integer) context.handleUnexpectedToken(Integer.class, parser);
            }
            return parser.getIntValue();
        }
    }

    public static final class StringValue extends ValueDeserializer<String> {
        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_STRING)) {
                return (String) context.handleUnexpectedToken(String.class, parser);
            }
            return parser.getString();
        }
    }
}
