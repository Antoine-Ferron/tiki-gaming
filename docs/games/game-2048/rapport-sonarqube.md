# 2048 : analyse SonarQube

> **Statut : fait (0 problème ouvert sur le 2048).** Ce document garde la trace de l'analyse de qualité du code du 2048 : ce que SonarQube a relevé, ce qu'on en a conclu et ce qu'on a corrigé.
> Issue : #89 · Branche : `game/game-2048/implementation` · PR : #94

## 1. Comment l'analyse a été faite

- **Outil** : SonarQube Community, lancé en local dans Docker et jeté après usage, avec la commande de la plateforme :

  ```sh
  sh quality/sonar-local.sh
  ```

- **Périmètre lu** : le dossier `frontend/src/games/game-2048` (411 lignes de code, hors tests).
- **Règles appliquées** : le Quality Gate « Sonar way ».
- **Date** : 5 novembre 2026.

Un test de mini-GTA a dépassé son délai de 5 s pendant la couverture (machine chargée par SonarQube) et a arrêté le script. On a relancé les mêmes étapes avec `--testTimeout=30000`. Ce test n'a pas de lien avec le 2048.

## 2. Ce que SonarQube a rapporté

**Projet entier** : Quality Gate **OK**.

**2048** :

| Mesure | Valeur |
|---|---|
| Bugs | 0 |
| Vulnérabilités | 0 |
| Security Hotspots | 0 |
| Code smells | 0 |
| Dette technique (SQALE) | 0 min, note **A** |
| Duplication | 0 % |
| Couverture en lignes | 98,3 % |
| Couverture en branches | 94,4 % |

Les fichiers du domaine (`line.ts`, `board.ts`, `spawner.ts`, `game.ts`), `keyboard.ts`, `services/finishGame.ts` et `components/Grid.tsx` sont à 100 %. Le seul fichier en dessous est **`Game2048Game.tsx`** (97,8 % des lignes, 85,7 % des branches).

## 3. Diagnostic

- **Aucun problème de qualité** : le domaine a été écrit en TDD, puis passé au mutation testing (Stryker, MSI de 100 %). Il n'y a rien à corriger.
- **Pas de faux positif sur les tests de propriétés.** SonarQube signale « test sans assertion » (règle S2699) sur les tests fast-check de la plateforme (`score.property.test.ts`), parce qu'il ne reconnaît pas `fc.assert(...)` comme une assertion. Nos propriétés (`domain/properties.test.ts`) ne sont pas signalées : chacune vérifie son résultat avec `expect` à l'intérieur de la propriété.
- **Le trou de couverture** : le message d'erreur quand le **classement ne se charge pas** n'était jamais testé. Les tests ne couvraient que le cas où tout se passe bien.
- **Branches restantes, laissées volontairement** :
  - la valeur par défaut du hasard (`randomSpawner()`), car les tests de l'interface injectent toujours un **stub** ;
  - certaines combinaisons d'erreurs en fin de partie, déjà couvertes par les tests du service `finishGame` et par les tests d'intégration.

## 4. Ce qu'on a corrigé

| Quoi | Étage | Comment |
|---|---|---|
| Message d'erreur quand le classement est indisponible | Test de composant | `getLeaderboard` remplacé par un **stub** qui échoue (`vi.spyOn(...).mockRejectedValue`) ; on vérifie que le joueur voit le message de la plateforme. |

Ce test porte sur du code déjà écrit : c'est un **test de caractérisation**, il passe au vert tout de suite.

## 5. Avant / après

| Mesure (2048) | Avant | Après |
|---|---|---|
| Problèmes (bugs, vulnérabilités, code smells) | 0 | 0 |
| Couverture en lignes | 98,3 % | **99,2 %** |
| Couverture en branches | 94,4 % | 94,4 % |
| Couverture globale Sonar (lignes + branches) | 96,9 % | **97,4 %** |
| Couverture en lignes de `Game2048Game.tsx` | 97,8 % | 100 % |

**À retenir** : une couverture élevée ne dit pas tout. L'analyse fichier par fichier montre où sont les trous ; ici, un chemin d'erreur que le joueur peut rencontrer.
