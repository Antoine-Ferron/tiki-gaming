package fr.tikigaming.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Active les tâches planifiées ({@code @Scheduled}) pour toute l'application. Réglage de plateforme : un jeu déclare
 * ses tâches, il n'active pas lui-même la planification.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {}
