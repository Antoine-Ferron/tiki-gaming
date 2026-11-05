package fr.tikigaming.games.mini_gta.features;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;

/**
 * Spécifications BDD de MiniGTA : les règles de {@code docs/games/mini-gta/regles.md} écrites en Gherkin
 * ({@code src/test/resources/fr/tikigaming/games/mini_gta/features/*.feature}) et exécutées par {@code mvn test}.
 */
@Suite
@IncludeEngines("cucumber")
@SelectPackages("fr.tikigaming.games.mini_gta.features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "fr.tikigaming.games.mini_gta.features")
class MiniGtaFeaturesTest {}
