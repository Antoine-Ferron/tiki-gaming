package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Énumération écrite en minuscules dans le JSON (« wood », « brown »), comme l'attend le front. */
interface LowercaseJson {

    String name();

    @JsonValue
    default String json() {
        return name().toLowerCase(Locale.ROOT);
    }
}
