# Mutation testing du moteur Dames

Mesure locale du 4 novembre 2026 sur la branche `game/dame/tests-unitaires`, avec PIT fourni par le dépôt et les mutateurs `STRONGER`. Aucun mutateur, seuil ou exclusion n'est modifié pour faire passer le résultat.

## Résultat par périmètre

| Périmètre | Mutants | Tués | Survivants | Score |
|---|---:|---:|---:|---:|
| Domaine Dames | 156 | 149 | 7 | **95,51 %** |
| Authentification conservée | 64 | 64 | 0 | 100 % |
| Profil complet | 220 | 213 | 7 | 96,82 % (97 % arrondi dans PIT) |

Aucun mutant sans couverture, en timeout, non viable ou en erreur d'exécution. Le seuil collectif de 75 % est respecté. Les pourcentages du domaine sont calculés depuis `mutations.xml`, sans les confondre avec le total incluant l'authentification.

## Analyse des sept survivants

| Emplacement | Mutation survivante | Analyse |
|---|---|---|
| `GameRules.apply`, ligne 57 | Suppression du garde d'origine nulle | La validation suivante par appartenance aux coups légaux refuse aussi une origine nulle : les parcours légaux contiennent des `Position` valides. Garde redondant pour le résultat métier testé. |
| `GameRules.apply`, ligne 58 | Suppression du garde de parcours vide | Aucun coup légal n'a un parcours vide ; le contrôle d'appartenance le refuse également. Garde redondant. |
| `GameRules.apply`, ligne 75 | Collecter aussi les cases traversées vides | Leur retrait final dans la copie de `Map` ne fait rien ; les seules pièces franchies d'un parcours déjà validé sont les victimes. Résultat de plateau identique. |
| `GameRules.manJumps`, ligne 130 | Remplacer `2 * direction[0]` par une division | Les directions valent exclusivement -1 ou 1 ; multiplication et division donnent le même déplacement entier ±2. |
| `GameRules.manJumps`, ligne 131 | Même mutation sur la colonne | Même équivalence pour le second axe. |
| `Board.initial`, ligne 37 | Remplacer `< 4` par `<= 4` | Les rangées 4 et 5 sont exclues avant cette condition ; la différence à 4 est inatteignable. |
| `Game.play`, ligne 34 | Retirer le refus explicite d'une partie terminée | Le moteur refuse encore tout coup car le camp au trait n'a plus de coup légal. Les assertions actuelles vérifient refus et atomicité, mais pas le message spécifique de fin de partie : c'est une limite identifiée, pas une équivalence absolue de tous les comportements observables. |

Ces résultats ne prouvent pas l'absence de défauts ni toutes les règles internationales. Les six équivalences ci-dessus sont argumentées sur les invariants du code actuel ; aucune exclusion n'est ajoutée pour les masquer. Le dernier survivant indique un point précis de sensibilité du contrat d'erreur à renforcer si ce message devient un critère fonctionnel.

## Reproduire

```bash
mvn -f backend/pom.xml -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage
```

Rapports régénérés dans `backend/target/pit-reports/index.html` et `mutations.xml`. Les artefacts générés restent hors Git ; la CI publie son propre rapport. Les tests d'intégration seront livrés dans une autre PR.
