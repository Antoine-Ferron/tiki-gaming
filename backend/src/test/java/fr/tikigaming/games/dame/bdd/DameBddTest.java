package fr.tikigaming.games.dame.bdd;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

/** Exécute les vrais fichiers .feature, y compris chaque ligne de leurs tableaux Exemples. */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/dame")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "fr.tikigaming.games.dame.bdd")
@ConfigurationParameter(key = "cucumber.junit-platform.naming-strategy", value = "long")
@ConfigurationParameter(
        key = PLUGIN_PROPERTY_NAME,
        value = "pretty,html:target/cucumber/dame.html,json:target/cucumber/dame.json,junit:target/cucumber/dame.xml")
public class DameBddTest {}
