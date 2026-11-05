package fr.tikigaming.games.mini_gta.features;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;

/**
 * Spécifications BDD de MiniGTA : les règles de {@code docs/games/mini-gta/regles.md} écrites en Gherkin
 * ({@code src/test/resources/fr/tikigaming/games/mini_gta/features/*.feature}) et exécutées par {@code mvn test}. Le
 * rapport HTML ({@code target/cucumber/mini-gta.html}, publié par la CI avec les autres rapports BDD) en est la
 * documentation vivante.
 */
@Suite
@IncludeEngines("cucumber")
@SelectPackages("fr.tikigaming.games.mini_gta.features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "fr.tikigaming.games.mini_gta.features")
@ConfigurationParameter(
        key = PLUGIN_PROPERTY_NAME,
        value = "html:target/cucumber/mini-gta.html,junit:target/cucumber/mini-gta.xml")
class MiniGtaFeaturesTest {}
