Feature: Partie de Mastermind

  Background:
    Given une partie de Mastermind est créée

  Scenario: Victoire dès la première proposition
    When le joueur propose le code secret
    Then la partie est gagnée
    And le score est de 10 points

  Scenario: Défaite après dix propositions incorrectes
    When le joueur propose dix combinaisons incorrectes
    Then la partie est perdue
    And le code secret est révélé

  Scenario: Couleurs répétées
    When le joueur propose une combinaison avec des couleurs répétées
    Then le feedback compte chaque couleur au plus une fois

  Scenario: Partie expirée
    When aucune action n'est faite pendant cinq minutes
    Then la partie est introuvable

  Scenario: Redémarrage
    When le joueur redémarre la partie
    Then l'historique est vide
    And le nouveau code secret reste masqué
