# Sudoku

Jeu solo de sudoku 9×9, jouable sans compte. Une partie a trois niveaux de difficulté, un chrono, un
compteur d'erreurs et un score envoyé au classement.

Le jeu a deux morceaux :

| Partie   | Rôle                                                        | Où                                          |
|----------|-------------------------------------------------------------|---------------------------------------------|
| Frontend | Interface, saisie, appels à l'API, sauvegarde de l'id de partie | `frontend/src/games/sudoku/`              |
| Backend  | API de génération, vérification et calcul du score          | `backend/src/main/java/fr/tikigaming/games/sudoku/` |

> **Principe** : la grille, sa solution, les erreurs, le temps et le score vivent sur le serveur. Le
> navigateur n'a jamais la solution : il affiche la grille reçue, envoie chaque saisie et le score classé est
> celui que renvoie `/check`.

## Frontend

### Fichiers

| Fichier                                  | Contenu                                                                 |
|------------------------------------------|-------------------------------------------------------------------------|
| `index.ts`                               | Déclaration du jeu : slug `sudoku`, catégorie `solo`, mode `solo`       |
| `SudokuGame.tsx`                         | Composant : choix de difficulté, grille, pavé numérique, appels à l'API, classement |
| `logic.ts`                               | Types, libellés des difficultés, format du temps                        |
| `mistakes.ts`                            | Règle des erreurs à l'affichage : reste permis, partie perdue, compteur « 2/3 », avertissements |
| `sudoku.css`                             | Styles, classes préfixées `sudoku-`, couleurs via les tokens de la charte |

Le jeu est aussi ajouté dans `frontend/src/games/registry.ts`.

### Fonctionnement

- **Difficultés** : facile (40 indices), moyen (32), difficile (26).
- **Partie** : `GET /api/games/sudoku/puzzle` crée la partie sur le serveur et renvoie `gameId` et la grille. Le
  front ne génère ni ne garde de solution.
- **Saisie** : clic sur une case puis chiffre au clavier (1 à 9), ou pavé à l'écran. Les flèches déplacent la
  sélection. Les indices de départ sont verrouillés. Chaque chiffre part sur `POST …/{gameId}/moves` : s'il est
  faux, la case reste vide, une erreur est comptée par le serveur et un message le signale. Il n'y a donc ni
  bouton « Effacer » ni conflits à afficher : seuls les bons chiffres entrent dans la grille.
- **Erreurs et chrono** : comptés et mesurés par le serveur ; le chrono affiché n'est qu'un affichage. Le compteur
  s'affiche « Erreurs : 2/3 ».
- **Partie perdue** : 3 erreurs sont permises, la 4e perd la partie. À 2/3 puis 3/3, un avertissement prévient. À la
  défaite, la grille disparaît, un message « Partie perdue : plus de 3 erreurs » s'affiche, aucun score n'est
  envoyé et la sauvegarde est effacée ; le joueur peut relancer une partie. Reprendre une partie déjà perdue
  mène au même écran. Le plafond (3) vient du serveur (`maxMistakes`) ; `mistakes.ts` n'en garde qu'une valeur
  par défaut pour le départ.
- **Fin de partie** : quand le serveur répond `complete`, le front appelle `POST …/check` et envoie à
  `ctx.submitScore` le `score` renvoyé. Il n'existe plus de formule de score côté front.
- **Reprise** : seul `{ gameId }` est sauvegardé. « Reprendre ma partie » relit l'état sur `GET …/{gameId}`
  (grille, saisies, erreurs, temps). Si le serveur ne connaît plus la partie (expirée, redémarrage), la
  sauvegarde est effacée et un message invite à en lancer une nouvelle.

### Plateforme (`GameContext`)

Le jeu n'importe jamais `@/lib/supabase` : tout passe par `ctx`.

| Appel                       | Usage dans le Sudoku                                              |
|-----------------------------|-------------------------------------------------------------------|
| `ctx.submitScore`           | Envoie le score à la fin d'une grille résolue                     |
| `ctx.getLeaderboard`        | Affiche le top 10                                                 |
| `ctx.getMyBest`             | Affiche « Ton meilleur score »                                    |
| `ctx.save` / `ctx.loadSave` | Sauvegarde l'id de la partie au départ, bouton « Reprendre ma partie » |
| `ctx.clearSave`             | Efface la sauvegarde quand la grille est terminée ou expirée      |

**Mode invité** (`ctx.player === null`) : le jeu reste jouable, le score n'est pas enregistré, la
sauvegarde est locale au navigateur, et un message invite à se connecter.

### Base de données

La migration `supabase/migrations/20261102145517_add_game_sudoku.sql` insère le jeu dans `public.games`
avec `category = 'solo'`, identique à `index.ts`.

## Backend (Spring Boot)

Package `fr.tikigaming.games.sudoku`. Les parties en cours sont gardées en mémoire côté serveur (`GameStore`) : le
client ne décide ni de la grille, ni de la difficulté, ni du temps.

### Classes

| Classe             | Rôle                                                                              |
|--------------------|-----------------------------------------------------------------------------------|
| `Difficulty`       | Niveaux `EASY`, `MEDIUM`, `HARD` : nombre d'indices, score de base, temps de référence ; `parse()` |
| `SudokuSolver`     | Règles : validation d'un placement, résolution, comptage de solutions, conflits  |
| `SudokuGenerator`  | Génère une grille à solution unique ; accepte un `Random` à graine fixe pour les tests |
| `ScoreCalculator`  | Règles métier du score (fonction pure)                                            |
| `ScoreBreakdown`   | Détail du score : base, bonus de temps, bonus sans faute, pénalité, total         |
| `SudokuBadRequestException` | Requête refusée : hérite de `config/ApiException`, renvoyée en 400 `{ error }` par `ApiExceptionHandler` |
| `SudokuGameOverException` | Partie perdue (plus de 3 erreurs) : hérite de `config/ApiException`, renvoyée en **409** `{ error }` |
| `GameStore`        | Parties en cours : grille, solution, saisies, erreurs et chrono (`GameTimer` + `Clock`) gardés côté serveur ; expiration 2 h, id clos dès la résolution ; 5 parties ouvertes par client et 10 000 au total, la plus ancienne est retirée au-delà |
| `SudokuService`    | Vérifie une partie (forme des grilles, indices intacts, conflits) et calcule le score |
| `SudokuController` | Les endpoints REST, documentés dans OpenAPI (tag « sudoku »)                      |
| `Clock`, `CurrencyConverter`, `AuditNotifier` | Contrats purs sans I/O (voir [Contrats d'abstraction](#contrats-dabstraction)) |
| `GameTimer`        | Chronomètre d'une partie, basé uniquement sur `Clock` (voir [Temps et tests](#temps-et-tests)) |
| `Ledger`, `LedgerEntry`, `RewardService` | Registre des pièces et service qui convertit un score en pièces (voir [Récompense en pièces](#récompense-en-pièces)) |

### API

| Méthode | Chemin                                  | Rôle                                                          |
|---------|-----------------------------------------|---------------------------------------------------------------|
| `GET`   | `/api/games/sudoku/puzzle?difficulty=easy`    | Nouvelle grille (`easy`, `medium`, `hard`). **La solution n'est jamais renvoyée.** |
| `GET`   | `/api/games/sudoku/{gameId}`            | État d'une partie en cours (sans la solution), pour la reprise |
| `POST`  | `/api/games/sudoku/{gameId}/moves`            | Saisit un chiffre ; le serveur compte les erreurs             |
| `POST`  | `/api/games/sudoku/check`                     | Vérifie la partie et calcule le score                         |

`GET /api/games/sudoku/puzzle` renvoie :

```json
{ "gameId": "3f2a…", "difficulty": "medium", "puzzle": [0, 3, 0, 0, 7, "… 81 valeurs, 0 = case vide"] }
```

`GET /api/games/sudoku/{gameId}` renvoie `gameId`, `difficulty`, `puzzle`, `values` (grille du joueur), `mistakes`,
`maxMistakes` (3), `lost` (partie perdue) et `seconds`.

`POST /api/games/sudoku/{gameId}/moves` reçoit `{ "cell": 40, "value": 7 }` (case de 0 à 80, ligne par ligne) et
renvoie `{ "correct": true, "mistakes": 0, "complete": false, "lost": false }`. Le serveur compare à sa solution : une saisie
juste entre dans la grille du serveur, une saisie fausse n'y entre pas et coûte une erreur (comptée à chaque
essai). Un indice de départ ou un chiffre hors 1 à 9 donne un 400.

**Limite d'erreurs** : 3 erreurs sont permises (`GameStore.MAX_MISTAKES`). La 4e répond `lost: true` ; ensuite
toute saisie, même juste, donne un **409** (`Partie perdue : trop d'erreurs`), et `POST …/check` aussi : une
partie perdue ne rapporte aucun score. La partie reste lisible par `GET …/{gameId}` (avec `lost: true`) jusqu'à
son expiration. Cela borne aussi l'effet d'oracle de `/moves` : au plus 4 essais ratés par partie.

`POST /api/games/sudoku/check` reçoit seulement `{ "gameId": "3f2a…" }`. Grille du joueur, difficulté, temps (de
`GET /puzzle` à l'appel, sur l'horloge du serveur) et erreurs sont ceux que le serveur a lui-même enregistrés :
le client ne fournit aucun chiffre du score. Une partie résolue est close, son `gameId` ne rapporte qu'un score.
Sans toutes les saisies faites par `/moves`, la grille reste incomplète et le score vaut 0.

et renvoie `complete`, `solved`, `conflicts` (indices des cases en doublon), `score` et `breakdown`.
Une entrée invalide (`gameId` inconnu, expiré ou déjà résolu, case ou chiffre invalide, difficulté inconnue) donne un **400** avec
`{ "error": "…" }` ; une partie perdue donne un **409** au même format.

Avec le backend lancé, la documentation interactive est sur `/swagger-ui/index.html`.

### Règles du score

Calculées dans `ScoreCalculator`, pour une grille **résolue** (0 sinon) :

1. **Base** : 1000 (facile), 2000 (moyen), 3000 (difficile).
2. **Bonus de temps à paliers progressifs** : les secondes gagnées sous le temps de référence
   (600 s, 900 s, 1200 s) rapportent 1 point/s sur les 120 premières, 2 points/s sur les 120 suivantes,
   3 points/s au-delà. Chaque palier ne s'applique qu'à sa tranche (comme un barème d'impôt).
3. **Seuil d'activation** : pas de bonus de temps si moins de 60 s ont été gagnées.
4. **Bonus « sans faute »** : aucune erreur pendant toute la partie, +10 % de (base + bonus de temps).
5. **Pénalité** : −50 points par erreur.

**Invariants** : le total reste entre 10 (plancher) et un plafond par difficulté (partie parfaite en
0 s : 2684 en facile) ; le calcul est une fonction pure et déterministe ; les entrées négatives sont
refusées ; un nombre d'erreurs énorme ne provoque pas de débordement.

Exemple, en facile, 540 s, 0 erreur : 1000 (base) + 60 (temps) + 106 (sans faute) = **1166**.

### Contrats d'abstraction

Trois interfaces sans I/O, propres au package Sudoku. Le code métier dépend d'elles plutôt que de
l'horloge système, d'un service de taux ou d'un journal : on peut ainsi les remplacer par des versions
en mémoire dans les tests. **Elles ne sont pas encore utilisées par le Sudoku** : aucune règle actuelle
n'a besoin d'une devise, d'un audit ou de l'heure.

| Interface           | Méthode                                      | Implémentation pure                                             |
|---------------------|----------------------------------------------|-----------------------------------------------------------------|
| `Clock`             | `Instant now()`                              | `SystemClock` (production, lit une `java.time.Clock` injectée, UTC par défaut) ; `FixedClock` (tests, avancée à la main) |
| `CurrencyConverter` | `BigDecimal convert(amount, from, to)`       | `FixedRateCurrencyConverter` : taux fixes en mémoire, passage par une devise de référence, arrondi à 2 décimales (au pair), refus des montants négatifs et des devises inconnues |
| `AuditNotifier`     | `void notify(AuditEvent event)`              | `RecordingAuditNotifier` (tests) : garde les événements en mémoire, dans l'ordre |

`AuditEvent` est un record immuable (type, date, détails copiés à la création) ; il refuse un type vide
ou une date manquante. `Clock` n'est pas `java.time.Clock` : attention à l'import si les deux servent
dans la même classe.

### Temps et tests

Règle du package : **le code Sudoku ne lit jamais l'heure directement** (`new Date()`, `Instant.now()`,
`System.currentTimeMillis()` sont interdits). Il demande l'heure à `Clock`, injectée. Seul `SystemClock`
lit l'heure réelle, et il peut lui-même recevoir une `java.time.Clock` figée ou décalée.

`GameTimer` en est l'exemple : `start()`, `elapsedSeconds()` (secondes entières, tronquées) et `stop()`
(fige la durée, idempotent). Il refuse les transitions invalides (démarrer deux fois, arrêter ou lire
avant le démarrage) et ne renvoie jamais une durée négative si l'horloge recule.

Les tests avancent `FixedClock` à la main : **aucun `sleep`**, donc aucun test dépendant du temps réel.
Par exemple, le bonus de temps de `ScoreCalculator` s'active à 540 s de jeu (en facile) et pas à 541 s ;
ces deux cas se vérifient instantanément.

*Hors du périmètre Sudoku* : `auth/SupabaseTokenService` (plateforme) appelle encore `Instant.now()`.

### Récompense en pièces

`RewardService` est le premier code qui s'appuie sur les contrats : pour un joueur et un score, il
convertit les points (`PTS`) en pièces (`TIKI`) avec `CurrencyConverter`, inscrit une ligne dans le
`Ledger` (registre) à l'heure donnée par `Clock`, puis envoie un événement `REWARD_GRANTED` à
`AuditNotifier`. Il renvoie les pièces créditées.

- **Seuil critique** : quand le solde d'un joueur passe de moins de 100 pièces à 100 ou plus, un second
  événement `CRITICAL_THRESHOLD_CROSSED` part vers l'audit (joueur, solde, seuil). Il part **une seule
  fois**, au franchissement : pas avant, pas sur les récompenses suivantes. Chaque joueur a son propre
  solde. Le seuil de 100 est une hypothèse.
- Un joueur vide ou un score négatif est refusé (`IllegalArgumentException`).
- Si la conversion échoue (devise inconnue), **ni le registre ni l'audit ne sont modifiés**.
- Un score de 0 est inscrit au registre pour 0 pièce.
- Le service est **hypothétique** : le taux `PTS` → `TIKI` et le principe de pièces n'existent pas dans
  la plateforme. Il n'est pas branché au Sudoku ni exposé par l'API.

`Ledger` est un contrat (`record`, `entriesOf`, `balanceOf`) : aucune implémentation de production
n'existe pour l'instant, seulement le fake en mémoire des tests.

## Tests

Les tests unitaires du backend sont dans `backend/src/test/java/fr/tikigaming/sudoku/` :

| Fichier                   | Vérifie                                                              |
|---------------------------|----------------------------------------------------------------------|
| `DifficultyTest`          | Lecture de la difficulté, valeur vide ou inconnue, scores de base    |
| `SudokuSolverTest`        | Doublons ligne, colonne, bloc, résolution, comptage de solutions     |
| `SudokuGeneratorTest`     | Nombre d'indices, solution unique, reproductibilité avec une graine  |
| `ScoreCalculatorTest`     | Paliers, seuil, bonus sans faute, bornes, déterminisme, débordement  |
| `SudokuServiceTest`       | Grille résolue, incomplète, en conflit, indice modifié, entrées invalides |
| `SudokuControllerTest`    | Réponses et erreurs 400, en appelant le controller comme un objet Java ; limite d'erreurs : 3 permises, 4e perd (`lost`), 409 sur `/moves` et `/check` d'une partie perdue, `lost` dans l'état |
| `GameStoreTest`           | Expiration, éviction, et limite d'erreurs : seuil 3/4, une saisie juste ne compte pas, partie perdue figée |
| `ClockTest`               | Horloge figée, avancée à la main ; `SystemClock` sur une horloge figée ou décalée |
| `GameTimerTest`           | Durée écoulée, troncature, arrêt, transitions invalides, horloge qui recule, seuil du bonus de temps à 540 s / 541 s |
| `FixedRateCurrencyConverterTest` | Conversion via la référence, arrondi, devise inconnue, montant négatif |
| `AuditNotifierTest`       | Ordre des événements, immutabilité des détails, entrées invalides    |
| `RewardServiceTest`       | Conversion au taux figé, registre, audit, solde, entrées invalides, échec de conversion |
| `RewardAuditMockTest`     | Mock Mockito de la passerelle d'audit : un seul appel au franchissement du seuil, ordre des événements, contenu, aucun appel si l'entrée est invalide |

**Doubles de test** (en RAM, dans `src/test`), tous sans I/O :

| Double                  | Type | Rôle                                                                   |
|-------------------------|------|------------------------------------------------------------------------|
| `StubCurrencyConverter` | Stub | Taux de change figé (ex. 1 PTS = 0,01 TIKI) ; refuse toute autre paire de devises |
| `InMemoryLedger`        | Fake | Vrai registre fonctionnel, stocké dans une liste                      |
| `FixedClock`            | Stub | Heure figée, avancée à la main                                         |
| `RecordingAuditNotifier`| Spy  | Garde les événements reçus pour les vérifier                           |
| `AuditNotifier` (Mockito) | Mock | Vérifie le comportement : combien d'appels, avec quoi, dans quel ordre. Aucun réseau possible |

Exigences : logique pure, aucun accès réseau ni disque, pas de contexte Spring. Le seul aléa est un
`Random` à graine fixe. Les tests à backtracking (générateur, solveur) prennent quelques dizaines de ms
à froid.

Côté front (`frontend/src/games/sudoku/`) : `SudokuGame.test.tsx` joue le composant contre un faux serveur (dont
la partie perdue : 3 erreurs permises, avertissement, défaite à la 4e sans score ni sauvegarde, reprise d'une
partie perdue, nouvelle partie), `logic.test.ts` le format du temps, et `mistakes.test.ts` la règle des erreurs
(valeurs exactes et bornes, 26 tests ; voir [Tests de mutation](#tests-de-mutation-stryker)).

Dans l'historique, la règle « valeur vide = manquante » est faite en cycle TDD : un commit `test`
(rouge), un commit `fix` (vert), un commit `refactor`.

### Tests d'intégration (Testcontainers)

`frontend/tests/integration/sudoku.test.ts` joue le Sudoku sur une vraie base PostgreSQL. Le conteneur
(image Supabase de production) est démarré une fois par `tests/integration/globalSetup.ts`, qui y rejoue
toutes les migrations du dépôt ; chaque test s'exécute ensuite dans une transaction annulée à la fin. Docker
est requis (`npm run test:integration`, depuis `frontend/`) ; sans Docker, les tests sont ignorés en local.

| Groupe                       | Vérifie                                                                                      |
|------------------------------|----------------------------------------------------------------------------------------------|
| Migrations rejouées          | Le jeu est au catalogue (catégorie `solo`, plafond 6864) ; un second rejeu n'applique rien ; les deux migrations du Sudoku sont suivies |
| Unicité                      | Slug `sudoku` unique (`games_pkey`) ; rejouer le SQL d'ajout échoue (`23505`) ; une sauvegarde par joueur et par jeu, l'écriture `on conflict` la remplace ; deux écritures simultanées sur deux connexions : l'une passe, l'autre est refusée, sans doublon |
| Scores et atomicité          | 0, 1 et 6864 acceptés, 6865 refusé (RLS), −1 refusé (`CHECK`) ; fin de partie en une étape : score refusé, la sauvegarde effacée revient ; score accepté, sauvegarde effacée et score écrit ; classement : meilleur score et nombre de parties |
| Atomicité d'une migration    | Une migration dont la seconde instruction viole l'unicité n'écrit rien : pas de ligne, pas de trace dans `schema_migrations` |

Le front fait aujourd'hui `clearSave` puis `submitScore` en deux appels séparés (pas une transaction) : le test
d'atomicité décrit ce que garantit la base si ces deux écritures sont regroupées, pas ce que fait le client.

### Tests E2E (Playwright)

`frontend/e2e/sudoku.spec.ts` joue le Sudoku dans un vrai navigateur, comme les autres parcours E2E (même
`playwright.config.ts`, lancés par le job `E2E (Playwright + axe)` de la CI sous Chromium, Firefox et WebKit).
Le backend et Supabase sont simulés : `frontend/e2e/sudokuServer.ts` rejoue le contrat de `/api/games/sudoku`
(`GET /puzzle`, `GET /{id}`, `POST /{id}/moves`, `POST /check`) avec une grille résolue connue et trois cases
vides. Il applique les règles du vrai serveur : les erreurs sont comptées côté serveur, la 4e perd la partie
(409 ensuite), et l'état survit à un rechargement de page.

| Parcours critique                    | Ce que le test vérifie                                                        |
|--------------------------------------|-------------------------------------------------------------------------------|
| Menu                                 | Les trois difficultés et le classement s'affichent                            |
| Partie gagnée                        | Score du serveur affiché, un seul appel à `/check`, invitation à se connecter (invité) |
| Chiffre faux                         | Case laissée vide, compteur « 1/3 », message, un appel à `/moves`             |
| Indice de départ                     | Verrouillé : aucune saisie envoyée au serveur                                 |
| Clavier                              | Flèches pour se déplacer, chiffre pour saisir                                 |
| Avertissement                        | « Plus qu'une erreur permise » à 2/3                                          |
| Partie perdue                        | 4e erreur : écran « Partie perdue », aucun `/check`, pas de reprise, on peut rejouer |
| Reprise après rechargement           | Grille, erreurs et chrono relus depuis le serveur                             |
| Partie oubliée par le serveur        | Message « Cette partie a expiré », la reprise disparaît                       |
| Accessibilité (axe, WCAG 2.1 AA)     | Aucune violation sérieuse ou critique sur l'écran de jeu                      |

Ces tests ont trouvé un vrai défaut : la grille portait `role="grid"` sans lignes ni cellules, ce qu'axe signale
en `aria-required-children` (critique). Elle porte désormais `role="group"` avec son libellé « Grille de sudoku ».

Lancer : `cd frontend && npx playwright test e2e/sudoku.spec.ts` (`--project=chromium` pour un seul navigateur).
Il faut les navigateurs Playwright installés (`npx playwright install`).

### Analyse statique (SonarQube)

Le Sudoku est analysé par le job `sonar` de la CI (SonarQube Cloud). Dernière analyse de la PR #21, avant
les correctifs ci-dessous : Quality Gate vert, 3 *code smells* (dette SQALE de 15 min) et aucun bug, aucune
vulnérabilité, aucune duplication.

| Règle        | Où                                      | Correction                                                                 |
|--------------|-----------------------------------------|----------------------------------------------------------------------------|
| `java:S6829` | `SystemClock`, `SudokuGenerator`        | Deux constructeurs : `@Autowired` sur le constructeur sans argument, celui que Spring doit utiliser (l'autre sert aux tests) |
| `typescript:S6852` | `SudokuGame.tsx` (`role="grid"`)  | D'abord `tabIndex={-1}`, puis `role="group"` : un `grid` sans lignes ni cellules est invalide (voir [Tests E2E](#tests-e2e-playwright)) ; un groupe n'est pas un rôle interactif, la navigation reste celle des cases |

Pour rescanner en local sans compte, un SonarQube Community suffit :
`docker run -d -p 9000:9000 sonarqube:community`, puis `npx @sonar/scan` depuis la racine avec
`-Dsonar.sources=backend/src/main/java/fr/tikigaming/games/sudoku,frontend/src/games/sudoku` et les rapports
JaCoCo et lcov. Après les correctifs, l'analyse locale du Sudoku donne : Quality Gate **OK**, 0 bug,
0 vulnérabilité, 0 *code smell*, 0 point sensible, dette SQALE 0, duplication 0 %, couverture 98 % (935 lignes).

### Tests de mutation (Stryker)

Stryker modifie le code (inverse une condition, vide un tableau, change un signe) et vérifie qu'un test échoue :
un mutant « survivant » est un comportement que les tests ne protègent pas, même si la ligne est couverte.
Le Sudoku n'est pas dans la configuration du dépôt (`frontend/stryker.config.mjs` ne mute que le cœur de la
plateforme) ; scan initial lancé à part, sur `logic.ts` et `SudokuGame.tsx`, avec les seuls tests du Sudoku
(`vitest.dir = src/games/sudoku`, car les tests des autres jeux n'ont pas toutes leurs dépendances en local).
Le calcul du score (`ScoreCalculator`) est en Java : il relève de Pitest, pas de Stryker.

| Fichier          | Score    | Tués | Timeout | Survivants | Non couverts |
|------------------|----------|------|---------|------------|--------------|
| `logic.ts`       | 100 %    | 12   | 0       | 0          | 0            |
| `SudokuGame.tsx` | 79,92 %  | 139  | 64      | 50         | 1            |
| Total (266 mutants) | **80,83 %** | 151 | 64 | 50         | 1            |

Les survivants de `SudokuGame.tsx` sont surtout :
- le clavier : le test des flèches ne vérifie pas chaque direction (`ArrowDown: [1, 0]` → `[]`,
  `ArrowLeft: [0, -1]` → `[0, +1]`), ni le `if (!d) return` ni le `preventDefault()` ;
- l'affichage conditionnel : « Ton meilleur score » sans meilleur score (`best !== null && …` → `true && …`) et
  le message d'erreur (`error && …` → `error || …`).

Ce premier scan date d'avant la limite d'erreurs.

#### Scan initial du moteur d'erreurs (`mistakes.ts`)

C'est le cas « 100 % de couverture, score bas » de l'atelier. Les premiers tests de `mistakes.test.ts` étaient
**volontairement faibles** : ils appelaient chaque fonction et chaque branche, mais ne vérifiaient qu'un type ou une
valeur définie, jamais la valeur exacte. C'était l'état de départ de l'exercice ; ils ont été renforcés ensuite
(voir « Élimination des mutants » plus bas).

| Mesure (tests de `mistakes.test.ts` seuls) | Résultat |
|---------------------------------------------|----------|
| Couverture (lignes, branches, fonctions)    | **100 %** (8/8, 4/4, 4/4) |
| Score de mutation                           | **25 %** (5 tués, 15 survivants sur 20 mutants) |

Survivants typiques : `isLost` reste « juste » avec `mistakes >= max`, `true` ou `false` (aucun test ne fixe la
frontière 3/4) ; `Math.min` devient `Math.max` dans le compteur ; les deux messages d'avertissement peuvent devenir
une chaîne vide ; `max - mistakes` devient `max + mistakes`.

Avec en plus les tests du composant (`SudokuGame.test.tsx`), qui jouent des parties entières (3 erreurs permises,
avertissement, défaite à la 4e), les mêmes mutants sont presque tous tués :

| Fichier          | Score       | Tués | Timeout | Survivants |
|------------------|-------------|------|---------|------------|
| `logic.ts`       | 100 %       | 12   | 0       | 0          |
| `mistakes.ts`    | 80 %        | 4    | 12      | 4          |
| `SudokuGame.tsx` | 93,8 %      | 146  | 111     | 16         |
| Total            | **93,14 %** | 162  | 123     | 20         |

Un test de composant protège donc le comportement, mais un test unitaire du moteur reste nécessaire : il tue les
mutants sans passer par l'interface et il fixe les bornes.

#### Élimination des mutants (objectif : score ≥ 75 %)

Les assertions de `mistakes.test.ts` donnent maintenant la valeur exacte attendue, surtout aux **bornes** (les
« conditions de remise et tranches horaires » de l'énoncé sont ici les seuils d'erreurs) :

| Mutant qui survivait | Assertion qui le tue |
|----------------------|----------------------|
| `mistakes > max` → `>=`, `<=`, `true`, `false` | `isLost` pour 0 à 3 erreurs (`false`) et 4, 5, 9 (`true`) : la frontière 3/4 est fixée ; et pour un plafond de 5 (5 → `false`, 6 → `true`) |
| `max - mistakes` → `max + mistakes` | `remainingMistakes(1, 3)` vaut 2, pas 4 |
| `Math.max(0, …)` retiré ou inversé | `remainingMistakes(4, 3)` et `(10, 3)` valent 0, jamais négatif |
| `Math.min` → `Math.max` dans le compteur | `mistakesLabel(4, 3)` vaut `'3/3'`, jamais `'4/3'` |
| `left === 0` / `left === 1` → `false` ou inversé | `mistakesWarning(3, 3)` et `(2, 3)` ; `(0, 3)` et `(1, 3)` valent `null` ; seuils recalculés pour un plafond de 5 |
| messages remplacés par `""` | comparaison au texte exact des deux avertissements |

| Mesure (tests de `mistakes.test.ts` seuls) | Avant | Après |
|---------------------------------------------|-------|-------|
| Couverture (lignes, branches, fonctions)    | 100 % | 100 % |
| Tests                                       | 5     | 26    |
| Score de mutation                           | **25 %** | **100 %** (20 mutants tués sur 20) |

L'objectif de 75 % (seuil `break` de `frontend/stryker.config.mjs`) est dépassé. La couverture n'a pas changé :
c'est la précision des assertions qui a fait passer le score de 25 % à 100 %.

#### Seuil bloquant dans la CI (GitHub)

Le job **`Mutation (Stryker)`** de `.github/workflows/ci.yml` lance `npm run test:mutation` à chaque PR touchant le
front (en incrémental : seuls les mutants des fichiers modifiés sont rejoués). Stryker termine en erreur quand le
score passe sous `thresholds.break` (75 % dans `frontend/stryker.config.mjs`), donc le job échoue et la PR est
marquée en échec.

Ce qui manquait pour le Sudoku : ses fichiers n'étaient pas dans `mutate`, donc le seuil ne s'y appliquait pas.
`logic.ts` et `mistakes.ts` y sont ajoutés (fichier de configuration commun à la plateforme, modification de deux
lignes). Les tests du Sudoku sont ceux du dépôt entier : le score en CI est donc au moins celui mesuré ici.

Vérification locale du mécanisme (mêmes fichiers, `vitest.dir = src/games/sudoku`) :

| Cas | Score | Seuil | Code de sortie |
|-----|-------|-------|----------------|
| `logic.ts` + `mistakes.ts`, tests actuels | 100 % (32 mutants tués) | 75 | **0** (succès) |
| `SudokuGame.tsx` seul, sous un seuil volontairement haut | 69,71 % | 99 | **1** : « Final mutation score 69.71 under breaking threshold 99 » |

`SudokuGame.tsx` n'est pas dans le périmètre de la CI : son score varie d'un scan à l'autre (jusqu'à 93,8 % plus
haut, 69,7 % ici, avec beaucoup de mutants en timeout), ce qui rendrait la PR bloquée au hasard. Les règles pures
(`logic.ts`, `mistakes.ts`) sont, elles, déterministes.

**Reste à faire côté dépôt (administrateur)** : une règle de protection (*ruleset* « Protected », branches `main`
et `dev`) exige seulement `Frontend (format + lint + build)` et `Backend (format + lint + tests)`. Pour que le
seuil bloque réellement la fusion, il faut y ajouter le check **`Mutation (Stryker)`** (Settings, Rules,
Rulesets, Protected, *Require status checks to pass*). Tant que ce n'est pas fait, un échec du job est visible
mais n'empêche pas de fusionner. Quand le front n'est pas modifié, le job est ignoré (*skipped*), ce que GitHub
compte comme réussi.

#### Rapport de la CI

Le rapport HTML produit par le job `Mutation (Stryker)` de la PR #104
([run 41845454002](https://github.com/EAnathos/tiki-gaming/actions/runs/41845454002), commit `6c13af6`, tous les
jobs en succès) est versionné dans [`docs/sudoku/stryker-mutation-ci.html`](sudoku/stryker-mutation-ci.html)
(à ouvrir dans un navigateur). C'est l'artefact `rapport-mutation-frontend`, sans modification.

| Périmètre                         | Score                                    |
|-----------------------------------|------------------------------------------|
| `sudoku/logic.ts`                 | 100 % (12 mutants tués)                  |
| `sudoku/mistakes.ts`              | 100 % (20 mutants tués)                  |
| Plateforme entière (`mutate` CI)  | **98,33 %** (354 tués, 6 survivants)     |

Seuil `thresholds.break` : 75 %, franchi. Le rapport est une photo du run ci-dessus : pour un résultat à jour,
télécharger l'artefact du dernier run de la CI.

Pour rejouer un scan : un fichier de configuration qui reprend `frontend/stryker.config.mjs` avec
`mutate: ['src/games/sudoku/mistakes.ts']` et, pour isoler les tests unitaires, un `vitest.configFile` dont
`test.include` ne liste que `src/games/sudoku/mistakes.test.ts` (ou `vitest: { dir: 'src/games/sudoku' }` pour tous
les tests du Sudoku), puis `npx stryker run <fichier>` depuis `frontend/`.

## Lancer en local

**Tests et couverture du backend** (aucune clé nécessaire) :

```bash
cd backend
mvn clean verify                     # Checkstyle, format, tests, rapport JaCoCo
mvn spotless:apply                   # reformate le code si le format échoue
xdg-open target/site/jacoco/index.html
```

Utilise `clean` si Maven plante avec `Unresolved compilation problems` : le plugin Java de VS Code
écrit aussi dans `target/`.

**Backend** : copier `backend/.env.example` en `backend/.env`, y mettre les vraies valeurs (sans les
chevrons `<>`), puis lancer **depuis `backend/`** :

```bash
cd backend
mvn spring-boot:run
```

**Frontend** (Node 22 ou plus récent) :

```bash
cd frontend
npm install
npm run dev
npm run lint && npm run format:check && npm run build   # avant de pousser
```

Pour voir le jeu dans le catalogue, la migration doit être appliquée à la base Supabase.

Le score est borné : `scoreLimits: { max: 6864 }` dans `index.ts` (SDK, avant l'envoi) et `games.max_score = 6864`
dans `supabase/migrations/20261103140000_sudoku_max_score.sql` (base, contre une insertion directe). 6864 est
le plafond de `ScoreCalculator` en difficile (partie parfaite en 0 s). Les deux valeurs doivent rester alignées.

## Commandes des tests et de la qualité

Toutes les commandes partent de la racine du dépôt. Le front demande Node 22 ou plus récent
(`export PATH=~/.nvm/versions/node/v22.16.0/bin:$PATH` si ton shell prend une version plus ancienne).

| Suite                              | Commande                                                                  | Prérequis        |
|------------------------------------|---------------------------------------------------------------------------|------------------|
| Tout le backend (le plus complet)  | `cd backend && mvn clean verify`                                          | Java 21          |
| Tests unitaires Java du Sudoku     | `cd backend && mvn test -Dtest='fr.tikigaming.games.sudoku.*Test'`        | Java 21          |
| Couverture Java (JaCoCo), rapport  | `cd backend && mvn test jacoco:report -Dtest='fr.tikigaming.games.sudoku.*Test'` puis `xdg-open target/site/jacoco/index.html` | Java 21 |
| Couverture Java avec les seuils    | `cd backend && mvn clean verify` (échoue sous les seuils JaCoCo)          | Java 21          |
| Une classe ou une méthode          | `cd backend && mvn test -Dtest=GameStoreTest` ou `-Dtest=GameStoreTest#nomDeLaMethode` | Java 21 |
| Tests unitaires front (tout)       | `cd frontend && npm test`                                                 | Node 22          |
| Tests unitaires front du Sudoku    | `cd frontend && npx vitest run src/games/sudoku`                          | Node 22          |
| Tests d'intégration (Testcontainers) | `cd frontend && npm run test:integration`                               | Docker lancé     |
| Intégration, Sudoku seulement      | `cd frontend && npx vitest run --config vitest.integration.config.ts tests/integration/sudoku.test.ts` | Docker lancé |
| Tests E2E (Playwright), Sudoku     | `cd frontend && npx playwright test e2e/sudoku.spec.ts`                   | Navigateurs Playwright |
| E2E, un seul navigateur            | `cd frontend && npx playwright test e2e/sudoku.spec.ts --project=chromium` | idem             |
| Tous les E2E (comme la CI)         | `cd frontend && npm run test:e2e`                                         | idem             |
| Mutation front (Stryker)           | `cd frontend && npm run test:mutation`                                    | Node 22          |
| Mutation Java (Pitest)             | `cd backend && mvn -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage` | Java 21 |
| Couverture front                   | `cd frontend && npm run test:coverage`                                    | Node 22          |
| Style Java (Checkstyle)            | `cd backend && mvn checkstyle:check`                                      | Java 21          |
| Format Java (Spotless)             | `cd backend && mvn spotless:check` (vérifie) ou `mvn spotless:apply` (corrige) | Java 21     |
| Lint front (ESLint)                | `cd frontend && npm run lint`                                             | Node 22          |
| Format front (Prettier)            | `cd frontend && npm run format:check` (vérifie) ou `npm run format` (corrige) | Node 22      |
| Types et build front               | `cd frontend && npm run typecheck && npm run build`                       | Node 22          |
| Migrations de la base              | `cd frontend && npm run db:check`                                         | Node 22          |

À savoir :

- **Avant de pousser**, lance au minimum `cd backend && mvn clean verify` et
  `cd frontend && npm run lint && npm run format:check && npm run build && npm test`.
- **Couverture Java** : `mvn clean verify` écrit le rapport dans `backend/target/site/jacoco/index.html` et échoue
  sous les seuils JaCoCo. La commande `mvn test jacoco:report -Dtest=…` génère le même rapport pour les seuls
  tests du Sudoku, sans les seuils : dans l'arbre du rapport, ouvrir `fr.tikigaming.games.sudoku` (mesuré avec
  ces 138 tests : lignes 100 %, branches 97,7 %). `target/site/jacoco/jacoco.xml` est le fichier que lit SonarQube.
- **Mutation** : le rapport Stryker est dans `frontend/reports/mutation/mutation.html`, celui de Pitest dans
  `backend/target/pit-reports/`. Stryker échoue sous 75 % ; le Sudoku (`logic.ts`, `mistakes.ts`) est dans son
  périmètre. Pitest ne cible pas encore les classes du Sudoku (seulement l'authentification et la résilience) :
  pour les mesurer, il faut ajouter `fr.tikigaming.games.sudoku.*` dans le profil `mutation` du `pom.xml`
  (configuration commune du backend).
- **Intégration** : le premier lancement télécharge l'image `supabase/postgres` ; compter quelques minutes.
- **E2E** : aucun backend à lancer, le serveur Vite démarre seul sur le port 5199 et les appels sont simulés.
  Si `npx playwright install` ne passe pas (disque plein, version de Chromium), voir
  [Tests E2E](#tests-e2e-playwright) : on peut utiliser le Chrome du système.
- **SonarQube en local** : `docker run -d -p 9000:9000 sonarqube:community`, puis `npx @sonar/scan` depuis la racine
  avec `-Dsonar.sources=backend/src/main/java/fr/tikigaming/games/sudoku,frontend/src/games/sudoku` et les rapports
  JaCoCo et lcov (détails dans [Analyse statique](#analyse-statique-sonarqube)). Sur un disque presque plein
  (plus de 90 %), SonarQube peut échouer au démarrage : il faut alors désactiver le seuil disque d'Elasticsearch
  (`-e SONAR_SEARCH_JAVAADDITIONALOPTS="-Dnode.store.allow_mmap=false -Dcluster.routing.allocation.disk.threshold_enabled=false"`
  et `-e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` sur la commande `docker run`).
- **Clé Supabase** : aucune de ces commandes n'en demande ; seul `mvn spring-boot:run` a besoin de `backend/.env`.

## Écarts connus

- **`/moves` sert d'oracle, mais borné** : un joueur peut deviner une case en lisant `correct`. Chaque essai raté
  coûte une erreur (−50, et plus de bonus « sans faute ») et la 4e erreur perd la partie : au plus 4 essais ratés
  par partie. En créer une autre reste possible (voir « Création de partie »).
- **Le classement reste alimenté par le navigateur** : le front envoie son score via `ctx.submitScore` et
  `/check` n'enregistre rien. Un joueur connecté peut donc insérer un score jusqu'au plafond (6864) sans jouer.
  Pour y remédier, le backend doit écrire le score à la résolution et l'insertion client doit être bloquée pour
  ce jeu (comme Prismine) : changement de plateforme, hors de ce package.
- **Création de partie** : `GET /puzzle` est public et la génération coûte du CPU ; seul le nombre de parties
  gardées est borné (5 par adresse, 10 000 au total), pas le débit d'appels.
- **Parties en mémoire** : perdues au redémarrage, non partagées entre plusieurs instances du backend.
