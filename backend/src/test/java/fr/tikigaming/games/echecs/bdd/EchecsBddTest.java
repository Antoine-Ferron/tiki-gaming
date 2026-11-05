package fr.tikigaming.games.echecs.bdd;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

/**
 * Lance les scénarios Gherkin du jeu d'échecs ({@code src/test/resources/features/echecs}) avec JUnit, donc dans
 * {@code mvn verify} et la CI. Le rapport HTML est la documentation vivante des règles. Les scénarios marqués
 * {@code @en-cours} (écrits d'avance, règle pas encore codée) sont exclus.
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/echecs")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "fr.tikigaming.games.echecs.bdd")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, html:target/cucumber-echecs.html")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "not @en-cours")
class EchecsBddTest {}
