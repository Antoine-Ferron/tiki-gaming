# Rush Hour : analyse SonarQube

> **Statut : corrigé (0 problème ouvert sur Rush Hour), puis prolongé par la mutation (section 7).** Ce document garde la trace de l'analyse de qualité du code de Rush Hour : ce que SonarQube a relevé, ce qu'on en a conclu, ce qu'on a corrigé et ce que ça a changé.
> Issue : #102 · Branche : `game/rush-hour/qualite-sonar` · PR : #…

---

## 1. Comment l'analyse a été faite

- **Date** : 4 novembre 2026, sur la branche `dev` (après la vérification serveur des parties, #92).
- **Outil** : SonarQube Community, lancé en local et jeté après usage, avec la commande de la plateforme :

  ```bash
  sh quality/sonar-local.sh
  ```

  Le script relance d'abord les tests avec leur couverture (`npm run test:coverage` pour le front, `mvn verify` pour le back), puis analyse tout le dépôt.
- **Règles appliquées** : le Quality Gate « Sonar way ». Le nouveau code doit avoir 0 nouveau problème, au moins 80 % de couverture et au plus 3 % de lignes dupliquées.

## 2. Ce que SonarQube a rapporté

**Projet entier** : Quality Gate **OK**. Couverture de 92,6 % et duplication de 0,1 %.

**Rush Hour** :

| | Front (`frontend/src/games/rush-hour`) | Back (`backend/…/games/rush_hour`) |
|---|---|---|
| Couverture en lignes | 94,8 % | 99,4 % |
| Couverture en branches | 87,6 % | 97,7 % |
| Duplication | 0 % | 0 % |
| Bugs | 0 | 0 |
| Vulnérabilités | 0 | 0 |
| Code smells | 1 | 0 |

**Fichiers les moins couverts** (tous dans l'interface) :

| Fichier | Couverture | Ce qui n'est jamais testé |
|---|---|---|
| `components/Board.tsx` | 61,5 % | Tout le **glisser-déposer à la souris** (lignes 44 à 61 et 91 à 94). Seul le déplacement au clavier est testé. |
| `RushHourGame.tsx` | 87,3 % | Le message d'erreur quand le **classement** ou la **progression** ne se charge pas (lignes 39, 47 et 48). |
| `components/LevelPlayer.tsx` | 87,5 % | Le message d'erreur quand l'**enregistrement d'une partie gagnée échoue** (ligne 61). |

**Le code smell** : règle `typescript:S7767` dans `testing/seededRandom.ts`, ligne 5 : « utiliser `Math.trunc` au lieu de `| 0` ».

## 3. Diagnostic

**Le code smell est un faux positif.** `seededRandom` est notre hasard reproductible pour les tests (algorithme mulberry32). Le `| 0` ne sert pas à arrondir : il ramène le nombre à un entier sur **32 bits**, comme le demande l'algorithme. Avec `Math.trunc`, le nombre grandirait sans limite et les suites de nombres changeraient. Les plateaux générés dans les tests ne seraient plus les mêmes. On ne suit donc pas cette règle, et on explique pourquoi.

**Le domaine est bien couvert, l'interface moins.** Les règles du jeu (déplacements, solveur, score, génération) et le back sont presque entièrement testés, parce qu'ils ont été écrits en TDD. Les trous sont dans le code d'interface :

- **Le glisser-déposer** est le geste principal du joueur, mais aucun test ne l'exerce. Les tests de l'interface jouent au clavier, plus simple à piloter. Une régression sur la souris ne serait donc vue par aucun test.
- **Les chemins d'erreur** : les tests ne couvrent que le cas où tout se passe bien. Si le serveur ne répond pas, rien ne garantit que le joueur voit un message plutôt qu'un écran figé.

**Pourquoi le Quality Gate passe quand même** : il juge le projet entier, et la très bonne couverture du domaine cache le trou de `Board.tsx`. L'analyse par fichier est ce qui le fait apparaître.

## 4. Ce qu'on va faire

Une issue et une PR dédiées, depuis `dev`. Chaque trou est testé à l'étage de la pyramide qui lui convient :

| Quoi | Étage | Comment |
|---|---|---|
| Le **calcul du glissé** : limité aux cases libres, arrondi à la case la plus proche, glissé nul ignoré | **Test unitaire, en TDD** | Le calcul sort de `Board.tsx` dans une fonction pure (par exemple `dragDelta(décalage, tailleCase, plage)`). Test rouge d'abord, puis extraction. |
| Le **geste de la souris** dans un vrai navigateur | **E2E (Playwright)** | Un ou deux parcours dans `frontend/e2e/` : glisser la voiture rouge jusqu'à la sortie, puis vérifier « Bravo ! » et le plateau bloqué. Le serveur est simulé par interception réseau, comme dans `mastermind.spec.ts`. |
| Les **messages d'erreur** : chargement du classement, chargement de la progression, enregistrement d'une partie gagnée | **Test de composant** | Testing Library avec les Fakes de la plateforme (`failNext`). Provoquer ces pannes en E2E serait lent et fragile. |
| Le **faux positif** `S7767` | — | Marqué dans SonarQube, avec la justification ci-dessus. |

Pour finir, on **relance l'analyse** et on compare.

**Pourquoi pas tout en jsdom** : jsdom ne calcule aucune mise en page. La largeur du plateau y vaut 0 et `setPointerCapture` n'existe pas. Un test du glisser-déposer dans jsdom demanderait de tout simuler et prouverait peu de chose. Le vrai geste se teste dans un vrai navigateur, et la logique qui en dépend se teste à part, sans navigateur.

**Notes sur la méthode** :

- **Le calcul du glissé suit un vrai cycle Rouge → Vert → Refactor.** La fonction pure n'existe pas encore : son test est d'abord rouge, et l'extraction depuis `Board.tsx` est le refactor.
- **Les tests d'erreur et l'E2E portent sur du code déjà écrit.** Ce sont des **tests de caractérisation** : ils fixent le comportement actuel et passeront sans doute au vert tout de suite. Si l'un d'eux révèle un bug, on revient au cycle TDD : test rouge, puis correction.
- **SonarQube ne compte pas l'E2E.** La couverture qu'il affiche vient seulement de Vitest. Les lignes du geste souris, couvertes par Playwright, resteront donc non couvertes dans le rapport. Un chiffre de couverture ne dit pas tout de ce qui est réellement protégé.

## 5. Ce qui a été fait

Branche `game/rush-hour/qualite-sonar`, dans l'ordre des commits :

| Commit | Étape | Ce qui a été fait |
|---|---|---|
| `test` | 🔴 Rouge | 16 cas aux frontières pour le calcul du glissé (`components/drag.test.ts`) : décalage borné aux cases libres, plateau sans largeur, case la plus proche au lâcher à ±0,5 et ±1,5 case. |
| `fix` | 🟢 Vert | `dragOffset` et `dropDelta`, fonctions pures (`components/drag.ts`). |
| `refactor` | 🔵 Refactor | `Board.tsx` utilise ces deux fonctions au lieu de faire le calcul lui-même. |
| `test` | Caractérisation | 3 tests de composant des pannes du serveur : classement indisponible, progression illisible, partie refusée. |
| `test` | E2E | `e2e/rush-hour.spec.ts` (Playwright) : niveau 1 gagné à la souris avec la partie envoyée au serveur, véhicule arrêté contre l'obstacle (R5), glissé de moins d'une demi-case ignoré. |
| `test` | 🔴 Rouge | Page Rush Hour ajoutée à l'audit d'accessibilité axe (`e2e/accessibilite.spec.ts`). |
| `fix` | 🟢 Vert | Nom des boutons de niveau construit à partir du texte visible. |
| `chore` | Faux positif | `NOSONAR` avec justification sur `seededRandom.ts`. |

**Deux bugs trouvés grâce aux tests :**

1. **Le glissé n'était pas symétrique.** `Math.round` arrondit -0,5 vers 0. Une demi-case vers la gauche ou vers le haut ne déplaçait donc pas le véhicule, alors qu'une demi-case vers la droite ou le bas suffisait. Le test rouge de `dropDelta` l'a montré (cas -0,5 et -1,5), et le vrai cycle TDD a permis de le corriger.
2. **Les boutons de niveau ne respectaient pas le critère WCAG 2.5.3** (« nom dans l'étiquette »). Leur nom lu, « Niveau 1, à jouer », venait d'un `aria-label` qui ne contenait pas le texte affiché (« 1 », « à jouer »). Un utilisateur de commande vocale qui dit « cliquer sur 1 » n'était pas compris. C'est l'audit axe ajouté à l'E2E qui l'a relevé.

**Vérification des tests de caractérisation.** Ils sont passés au vert tout de suite, comme prévu. Pour prouver qu'ils vérifient vraiment quelque chose, on a cassé à la main chacun des trois chemins d'erreur (message supprimé, mauvaise progression) : les trois tests ont échoué. C'est une **mutation faite à la main** (voir le cours J3_AM), avant d'outiller la mutation avec Stryker.

**Faux positif : pourquoi `NOSONAR` dans le code plutôt que dans l'interface ?** Une exception cochée dans l'interface de l'instance locale disparaît avec le conteneur, et SonarQube Cloud (en CI) ne la verrait pas. Le commentaire est versionné, relu en revue, et vu par les deux analyses.

**Limite relevée.** WebKit ne s'installe pas sur Arch Linux (système non pris en charge par Playwright) : les E2E ont été vérifiés en local sur Chromium et Firefox. La CI, sur Ubuntu, les lance aussi sur WebKit.

## 6. Résultats et amélioration

Nouvelle analyse le 4 novembre 2026, sur la branche `game/rush-hour/qualite-sonar`, avec la même commande.

| Mesure (front Rush Hour) | Avant | Après |
|---|---|---|
| Couverture Sonar (lignes + branches) | 92,1 % | **93,3 %** |
| Couverture en lignes | 94,8 % | **96,1 %** |
| Couverture en branches | 87,6 % | **88,7 %** |
| `RushHourGame.tsx` | 87,3 % | **94,5 %** (toutes les lignes couvertes) |
| `LevelPlayer.tsx` | 87,5 % | **90,6 %** (toutes les lignes couvertes) |
| `components/drag.ts` (nouveau) | — | **100 %** |
| `Board.tsx` | 61,5 % | 62,3 % (voir ci-dessous) |
| Problèmes ouverts sur Rush Hour | 1 (faux positif) | **0** |
| Bugs / vulnérabilités / duplication | 0 / 0 / 0 % | 0 / 0 / 0 % |
| Tests Vitest Rush Hour | 276 | **295** |
| Parcours E2E Rush Hour (non comptés par Sonar) | 0 | **3** + audit d'accessibilité, sur 3 navigateurs |
| Bugs trouvés | — | **2** (glissé asymétrique, nom des boutons de niveau) |

**Pourquoi `Board.tsx` ne bouge presque pas.** C'était prévu (section 4). Le calcul du glissé est sorti dans `drag.ts`, couvert à 100 % par des tests unitaires. Les lignes restantes de `Board.tsx` sont les gestionnaires d'événements de la souris (`onPointerDown`, `onPointerMove`, `onPointerUp`) : seuls les E2E Playwright les exécutent, et SonarQube ne lit que la couverture de Vitest. Ce geste est donc **protégé, mais pas compté**. Un chiffre de couverture ne dit pas tout de ce qui est réellement testé.

**Quality Gate : analyse locale ≠ SonarQube Cloud.** Sur l'instance **locale**, le gate « Sonar way » est passé en ERROR à la deuxième analyse, pour une seule condition : `new_violations > 0`. Cette instance compte comme « nouveau code » tout ce qui a changé depuis sa première analyse, ce qui inclut la PR plateforme #105, fusionnée entre-temps. Les 7 alertes concernées viennent de cette PR, pas de Rush Hour :
- 6 alertes « test sans assertion » (S2699) dans `src/games/domain/score.property.test.ts`. Ce sont des **faux positifs** : ces tests fast-check vérifient leur résultat dans `fc.assert(fc.property(...))`, que Sonar ne reconnaît pas comme une assertion ;
- une alerte « expression régulière lente » (S8786) dans `scripts/rtm.mjs`.

Le gate de **SonarQube Cloud**, celui de la CI, n'a pas les mêmes conditions et **passe** : ces alertes de fiabilité et de maintenabilité ne le bloquent pas. Pour la plateforme, elles relèvent d'un nettoyage, sans urgence. Sur le nouveau code de l'analyse locale, la couverture est de 97,7 % et la duplication de 0 %.

**Leçon pour la lecture d'un rapport.** Un statut de gate n'a de sens qu'avec son contexte : quelle instance, quel profil de règles, quelle période de « nouveau code ». Ici, l'alerte `S7767` de Rush Hour a disparu **sur notre branche**, mais elle reste visible sur `dev` et sur les autres PR tant que celle-ci n'est pas fusionnée.

**Ce qui reste, et où ça se traite.** Quelques branches ne sont pas couvertes dans `LevelPicker.tsx` et `LevelPlayer.tsx` (texte d'un indice vers le haut ou vers la gauche, par exemple). Elles ne valent pas un test de composant de plus. La suite logique est la **mutation** (Stryker / Pitest, cours J3_AM) : vérifier non plus que le code est *exécuté*, mais que les tests *détectent* une modification.

## 7. Suite : la mutation (Stryker et Pitest)

La couverture dit qu'une ligne a été **exécutée**, pas qu'un test **vérifie** son résultat (cours J3_AM, « l'illusion de la couverture »). La mutation le mesure : l'outil introduit un petit bug dans le code (un `>` changé en `>=`, un `+` en `-`, une condition remplacée par `true`…) et regarde si un test échoue. Un mutant **tué** prouve que les tests protègent cette ligne. Un mutant **survivant** révèle soit un test qui manque, soit du code en trop.

Rush Hour ne faisait partie d'aucune campagne de mutation : ni Stryker (front) ni Pitest (back).

### Ce que la mutation a trouvé avant même de muter

Le premier lancement de Stryker a échoué : le **test de contrat** lisait `shared/games/rush-hour/contrat.json` par un chemin fixe (`../../../..`). Or Stryker copie `frontend/` dans un bac à sable (`frontend/.stryker-tmp/sandbox-…`), et le chemin n'y menait plus nulle part. La CI ne le voyait pas, parce que Rush Hour n'était pas muté. Le test cherche maintenant le contrat en remontant les dossiers.

### Mutants survivants et traitement

| Où | Mutant | Diagnostic | Traitement |
|---|---|---|---|
| `generator.ts` | `random() * n` remplacé par `random() / n` | Le générateur prenait toujours la 1ʳᵉ disposition de la réserve, et aucun test ne le voyait | **Test** : chaque disposition peut être tirée |
| `session.ts` | `?.` remplacé par `.`, `if (next)` remplacé par `true` | Aucun test d'indice sur un plateau sans solution | **Test** : ni indice, ni indice compté |
| `session.ts` | `if (this.solved) return null` remplacé par `false` | **Équivalent** : la solution d'un plateau gagné est vide | **Ligne supprimée** (code en trop) |
| `moves.ts` | retrait du filtre « sauf le véhicule lui-même » | **Équivalent** : les cases du véhicule ne sont jamais testées | **Filtre supprimé** (code en trop) |
| `SolutionVerifier.java` | `delta > 0` remplacé par `true` | Aucun test de recul contre un autre véhicule | **Test** |
| `SolutionVerifier.java` | `target + length > SIZE` remplacé par `false` | Aucun test de dépassement du bord droit | **Test** |
| `SolutionVerifier.java` | `total != 0` remplacé par `false` | La fusion R6 perdue passait inaperçue si le coup suivant touchait le même véhicule | **Test** : un coup fusionné suivi d'un autre véhicule |
| `SolutionVerifier.java:79-80`, `Solver.java:72` | changements de borne, boucle | **Équivalents** : `delta = 0` est refusé plus tôt, et `Board.parse` garantit une voiture rouge | Gardés, documentés ici |

Chaque nouveau test a été vérifié en réappliquant le mutant à la main : il échoue avec le mutant et passe sur le vrai code.

### Résultats

| | Avant | Après |
|---|---|---|
| Score de mutation (MSI) front (domaine + `drag.ts`) | 98,65 % (6 survivants) | **100 %** (436 mutants neutralisés) |
| Score de mutation (MSI) back (`rush_hour`) | 95 % (8 survivants) | **97 %** (4 survivants, tous équivalents) |
| Dans la mutation de la CI | non | **oui** (`stryker.config.mjs`, profil `mutation` du `pom.xml`) |

Les deux scores dépassent largement le seuil de 75 % du cours et de la plateforme. Ce n'est pas surprenant pour un domaine écrit en TDD : chaque ligne y est née pour faire passer un test. La mutation a quand même trouvé **3 cas limites non testés** et **2 bouts de code inutiles**. Une couverture de 96 % ne les aurait jamais montrés.

**Coût.** La campagne complète du front prend environ 6 minutes en local, parce que 61 % des mutants sont « statiques » (des valeurs définies au niveau du module, qui obligent à relancer toute la suite). En CI, Stryker tourne en mode **incrémental** sur les PR : seuls les mutants des fichiers modifiés sont rejoués.
