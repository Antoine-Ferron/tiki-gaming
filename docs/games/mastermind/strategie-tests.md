# Stratégie de tests du Mastermind

## Périmètre

Le domaine Mastermind est testé sans I/O avec une horloge et des données déterministes. Les contrôleurs sont
testés avec MockMvc, puis l'API complète avec Spring Boot. Les parcours critiques sont vérifiés par Playwright.

| Niveau | Objectif | Seuil ou règle |
|---|---|---|
| Unitaire | feedback, validation, score, transitions d'état | 100 % des règles métier critiques |
| Propriété/fuzzing | invariants sur 1 000 combinaisons reproductibles | feedback cohérent, score borné, couleurs énumérées |
| Intégration | contrat HTTP, erreurs, isolation des parties | secret masqué, propriétaire obligatoire, validation serveur |
| Mutation | vérifier que les assertions détectent les erreurs | Pitest ≥ 75 % sur `games.mastermind` |
| BDD | décrire les parcours métier dans le langage du joueur | victoire, défaite, répétitions, expiration, redémarrage |
| E2E | vérifier les parcours vitaux et l'accessibilité clavier | Playwright + axe, sans tester chaque détail visuel |
| Performance | mesurer les endpoints de partie | P95 < 300 ms, P99 < 500 ms, erreurs < 1 % |

## Invariants

- Une proposition contient exactement quatre couleurs de `MastermindColor`.
- `exact + misplaced` est inférieur ou égal à quatre.
- Le secret n'est jamais renvoyé quand la partie est en cours.
- Le score d'une victoire est compris entre 1 et 10 ; une partie non gagnée vaut 0.
- Un UUID de partie n'est utilisable que par l'adresse cliente qui l'a créée.
- Les opérations concurrentes sur une même partie sont sérialisées.

Les tests aléatoires utilisent une graine fixe afin de rester reproductibles en CI.
