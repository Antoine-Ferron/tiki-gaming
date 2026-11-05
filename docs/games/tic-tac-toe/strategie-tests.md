# Stratégie de tests du Tic-Tac-Toe

## Objectif

Cette stratégie couvre les risques du Tic-Tac-Toe au niveau le plus bas capable de
les détecter. Le domaine reste pur et en mémoire ; Playwright est réservé aux
parcours que seuls le navigateur et l'accessibilité peuvent valider.

## Risques et niveaux de test

| Risque                                                          | Gravité | Preuve                                         |
| --------------------------------------------------------------- | ------: | ---------------------------------------------- |
| Une case occupée est écrasée ou un joueur joue deux fois        |   Haute | Tests domaine Java/TypeScript et BDD           |
| Une ligne, colonne ou diagonale gagnante est mal détectée       |   Haute | Tests unitaires, Scenario Outline et mutation  |
| Un match nul ou un coup après la fin est mal géré               |   Haute | Tests domaine et BDD                           |
| Le score de session est perdu au redémarrage                    | Moyenne | Tests composant et E2E                         |
| La grille ou l'annonce de victoire est inutilisable au clavier  | Moyenne | Tests composant et audit axe-core E2E          |
| Le domaine diverge entre les implémentations Java et TypeScript | Moyenne | Suites de règles équivalentes et revue de code |

## Techniques appliquées

- **Boîte noire** : partitions coup valide/occupé/invalide, partie active/terminée,
  victoire/nul, avec valeurs limites de coordonnées `-1`, `0`, `2` et `3`.
- **Boîte blanche** : couverture des branches de victoire, de changement de joueur,
  de grille pleine et de refus après fin.
- **TDD et AAA** : les tests du domaine sont déterministes, isolés et structurés
  Arrange/Act/Assert.
- **Mutation** : Stryker vérifie que les assertions détectent les modifications
  des règles du domaine ; le seuil est fixé à 75 %.
- **E2E** : deux parcours critiques couvrent victoire, score et replay ; l'audit
  axe-core couvre la page réellement rendue.

## Périmètre d'intégration

Le Tic-Tac-Toe actuel est local : il n'envoie ni partie ni score à un endpoint et
ne persiste pas d'état. Testcontainers, Pact, k6, Toxiproxy et ZAP ciblé ne
peuvent donc pas produire une preuve fonctionnelle sans créer une nouvelle
frontière applicative. Cette non-applicabilité est vérifiable dans le composant,
le registre du jeu et l'absence de route `/api/games/tic-tac-toe`.

Si une exigence de classement, de reprise de partie ou de synchronisation réseau
est ajoutée, cette décision devra être réévaluée : la nouvelle frontière devra
alors être couverte par intégration réelle, contrat, charge et résilience.

## Commandes de preuve

```bash
npm test -- --run src/games/tic-tac-toe
npm run rtm:check
npx playwright test e2e/tic-tac-toe.spec.ts --project=chromium
npm run lint
npm run build
npm run test:mutation -- --mutate src/games/tic-tac-toe/domain/game.ts
```
