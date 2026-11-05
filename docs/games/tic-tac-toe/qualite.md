# Qualité du Tic-Tac-Toe

## Périmètre

Les mesures portent sur le domaine TypeScript pur du Tic-Tac-Toe et ses scénarios
Vitest-Cucumber. Aucun navigateur, réseau, stockage ou service externe n'est utilisé.

## Résultats

Commande de couverture ciblée :

```bash
npx vitest run src/games/tic-tac-toe/features/tictactoe.steps.test.ts --coverage \
  --coverage.include=src/games/tic-tac-toe/domain/game.ts \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 \
  --coverage.thresholds.statements=0 --coverage.thresholds.branches=0
```

| Mesure | Résultat | Objectif |
|---|---:|---:|
| Tests BDD | 22/22 | 100 % |
| Lignes | 100 % (22/22) | >= 80 % |
| Fonctions | 100 % (14/14) | >= 80 % |
| Instructions | 96,77 % (30/31) | >= 80 % |
| Branches | 89,28 % (25/28) | >= 80 % |

Commande de mutation :

```bash
npm run test:mutation -- --mutate src/games/tic-tac-toe/domain/game.ts
```

Stryker a analysé 115 mutants : 111 tués, 0 survivant, 4 non couverts, soit
un score de mutation de **96,52 %**, supérieur au seuil minimal de 75 %.

Les mutants non couverts concernent des chemins déjà impossibles à atteindre
depuis les scénarios sélectionnés ; aucun mutant survivant n'est accepté sur le
domaine. Les messages d'erreur d'occupation et de coordonnées sont vérifiés
explicitement par les step definitions BDD.

## Commandes de qualité

Les contrôles généraux du frontend passent avec :

```bash
npm run lint
npm run build
```

La couverture globale du frontend doit être exécutée avec `npm run test:coverage`
sur la suite complète ; une exécution limitée au seul fichier BDD ne peut pas
respecter les seuils globaux du projet.
