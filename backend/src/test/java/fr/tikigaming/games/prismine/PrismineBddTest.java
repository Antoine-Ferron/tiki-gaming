package fr.tikigaming.games.prismine;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

/**
 * Lance les scénarios Gherkin de Prismine ({@code src/test/resources/features/prismine}) avec JUnit, donc dans
 * {@code mvn verify} et la CI. Le rapport HTML est la documentation vivante des règles d'une expédition.
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/prismine")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "fr.tikigaming.games.prismine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, html:target/cucumber-prismine.html")
class PrismineBddTest {}
