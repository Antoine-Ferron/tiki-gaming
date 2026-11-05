# Sudoku : erreurs volontaires (branche `sudoku/anomali`)

Cette branche contient des défauts **volontaires**, un par outil de test ou de qualité, pour obtenir un vrai message d'erreur de chaque outil. Tout est limité au package Sudoku. Les commandes de lancement sont dans [sudoku.md](../sudoku.md#commandes-des-tests-et-de-la-qualité).

Le lien entre un défaut et un outil est volontairement direct : un défaut, un fichier, un outil qui échoue en premier.

## Qualité : réparable par une commande

| # | Outil | Fichier cassé | Ce qui est cassé | Détecter | Réparer |
|---|-------|---------------|------------------|----------|---------|
| Q1 | Prettier (format front) | `frontend/src/games/sudoku/sudoku.css` | Accolade collée, indentation incohérente, espace avant `;` | `cd frontend && npm run format:check` | `npm run format` |
| Q2 | ESLint (lint front) | `frontend/src/games/sudoku/logic.ts` l.11 | `let m` au lieu de `const m` (règle `prefer-const`) | `cd frontend && npm run lint` | `npx eslint --fix src/games/sudoku` |
| Q3 | Spotless (format Java) | `backend/.../games/sudoku/Clock.java` | Import `java.util.List` inutilisé, `Instant   now();` mal indenté | `cd backend && mvn spotless:check` | `mvn spotless:apply` |

Après réparation, `git diff` montre exactement la correction faite par l'outil.

## Qualité : correction manuelle (aucune commande ne répare)

| # | Outil | Fichier cassé | Ce qui est cassé | Détecter | Réparer |
|---|-------|---------------|------------------|----------|---------|
| Q4 | TypeScript (`tsc`) | `frontend/src/games/sudoku/index.ts` l.14 | `scoreLimits: { max: '6864' }` : une chaîne à la place d'un nombre (TS2322) | `cd frontend && npm run typecheck` | Remettre `6864` sans guillemets |
| Q5 | Checkstyle (lint Java) | `backend/.../games/sudoku/SystemClock.java` | `if (source == null) return Instant.EPOCH;` sans accolades (règle `NeedBraces`) | `cd backend && mvn checkstyle:check` | Ajouter les accolades (ou supprimer le `if` inutile) |

Checkstyle tourne dès la phase `validate` : tant que Q5 est présent, **toute** commande `mvn` échoue avant les tests. Pour lancer quand même les tests Java, ajouter `-Dcheckstyle.skip=true`.

## Tests : un test existant devient rouge

| # | Outil | Fichier cassé | Ce qui est cassé | Détecter | Tests qui échouent |
|---|-------|---------------|------------------|----------|--------------------|
| T1 | Vitest (unitaire front) | `frontend/src/games/sudoku/mistakes.ts` | `isLost` : `mistakes >= max` au lieu de `>` (perdue à la 3e erreur au lieu de la 4e) | `cd frontend && npx vitest run src/games/sudoku` | `mistakes.test.ts` (3 erreurs sur 3 : la partie continue), plusieurs de `SudokuGame.test.tsx` |
| T2 | Vitest (composant) | `frontend/src/games/sudoku/SudokuGame.tsx` l.198 | Libellé « Erreurs : » changé en « Fautes : » | idem | Plusieurs tests de `SudokuGame.test.tsx`. Le même défaut casse aussi l'E2E : `npm run test:e2e -- sudoku.spec.ts` |
| T3 | JUnit (unitaire Java) | `backend/.../games/sudoku/GameStore.java` l.24 | `MAX_MISTAKES = 4` au lieu de 3 | `cd backend && mvn -Dcheckstyle.skip=true test -Dtest=GameStoreTest,SudokuControllerTest` | `SudokuControllerTest` : `stateReturnsGridMistakesAndTimeWithoutSolution`, `threeMistakesAreAllowedAndTheFourthLosesTheGame` |
| T4 | Intégration (Testcontainers) | `supabase/migrations/20261103140000_sudoku_max_score.sql` | Plafond de score `9999` au lieu de `6864` | `cd frontend && npm run test:integration` (Docker requis) | `sudoku.test.ts` : « le jeu est au catalogue après le rejeu, avec son plafond de score ». En CI, le job « Migrations déjà mergées inchangées » échoue aussi, car la migration a été modifiée |
| T5 | Playwright (E2E) | mêmes défauts que T1 et T2 | Voir T1 et T2 | `cd frontend && npm run test:e2e -- sudoku.spec.ts` | Scénarios qui lisent « Erreurs : » ou qui jouent la 4e erreur |

Réparation de T1 à T4 : annuler la modification dans le fichier cassé (`git checkout <commit-avant> -- <fichier>`, ou corriger la ligne indiquée).

## Mutation : tests verts, mais trop faibles

| # | Outil | Fichier cassé | Ce qui est cassé | Détecter |
|---|-------|---------------|------------------|----------|
| M1 | Stryker (mutation front) | `frontend/src/games/sudoku/logic.ts`, fin du fichier | Ajout de `timeBonus` (4 paliers, aucun test) : ses mutants survivent, le score passe sous le seuil de 75 % (non mesuré : Stryker refuse de démarrer tant que T1 et T2 sont présents) | `cd frontend && npx stryker run stryker.sudoku.config.mjs` |

Stryker exige que **tous les tests soient verts** au départ. Il faut donc annuler T1 et T2 avant de le lancer, sinon il s'arrête sur « tests failed in initial run ». Réparation : écrire des tests de `timeBonus` (0, 59, 60, 179, 180, 299, 300, au-delà) ou supprimer la fonction.

## Non appliqués

| Outil | Pourquoi | Comment le provoquer |
|-------|----------|----------------------|
| Pitest (mutation Java) | Le profil `mutation` du `pom.xml` ne cible pas le Sudoku, et il demande aussi des tests verts | Ajouter `fr.tikigaming.games.sudoku.*` à `targetClasses` et `fr.tikigaming.games.sudoku.*Test` à `targetTests`, annuler T3, puis retirer des assertions dans `ScoreCalculatorTest` |
| JaCoCo (seuils de couverture) | Le seuil global est de 52 % de lignes : il faudrait ajouter beaucoup de code non testé | Ajouter une grosse classe sans test dans le backend |
| axe (accessibilité) | `accessibilite.spec.ts` ne couvre pas le Sudoku | Ajouter `sudoku` à ce scénario puis une `<img>` sans `alt` dans `SudokuGame.tsx` |

## Ordre conseillé pour une démonstration

1. Qualité réparable : Q1, Q2, Q3, avec `format:check`, `lint` et `spotless:check`, puis les commandes de réparation.
2. Qualité manuelle : Q4 et Q5.
3. Tests rouges : T1 à T5.
4. Annuler T1 et T2, puis lancer Stryker pour M1.
