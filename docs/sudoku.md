# Sudoku

Jeu solo de sudoku 9×9, jouable sans compte. Une partie a trois niveaux de difficulté, un chrono, un
compteur d'erreurs et un score envoyé au classement.

Le jeu a deux morceaux :

| Partie   | Rôle                                                        | Où                                          |
|----------|-------------------------------------------------------------|---------------------------------------------|
| Frontend | Interface, génération locale de la grille, saisie, sauvegarde | `frontend/src/games/sudoku/`              |
| Backend  | API de génération, vérification et calcul du score          | `backend/src/main/java/fr/tikigaming/sudoku/` |

> **État actuel** : le frontend n'appelle pas encore l'API. Il génère sa grille et calcule son score
> lui-même, avec l'ancienne formule (voir [Écarts connus](#écarts-connus)).

## Frontend

### Fichiers

| Fichier                                  | Contenu                                                                 |
|------------------------------------------|-------------------------------------------------------------------------|
| `index.ts`                               | Déclaration du jeu : slug `sudoku`, catégorie `solo`, mode `solo`       |
| `SudokuGame.tsx`                         | Composant : choix de difficulté, grille, pavé numérique, classement     |
| `logic.ts`                               | Logique pure : génération, validation, conflits, score, format du temps |
| `sudoku.css`                             | Styles, classes préfixées `sudoku-`, couleurs via les tokens de la charte |

Le jeu est aussi ajouté dans `frontend/src/games/registry.ts`.

### Fonctionnement

- **Difficultés** : facile (40 indices), moyen (32), difficile (26).
- **Génération** : une grille complète est créée par backtracking, puis des cases sont retirées une à une.
  Une case n'est retirée que si la grille garde **une seule solution**.
- **Saisie** : clic sur une case puis chiffre au clavier (1 à 9), ou pavé à l'écran. `Suppr`,
  `Retour arrière` et `0` effacent. Les flèches déplacent la sélection. Les indices de départ sont
  verrouillés.
- **Aides visuelles** : ligne et colonne de la case sélectionnée en surbrillance, doublons soulignés et
  en rouge (jamais la couleur seule).
- **Erreurs** : une erreur est comptée quand le chiffre posé ne correspond pas à la solution.
- **Fin de partie** : la grille est résolue quand toutes les cases égalent la solution.

### Plateforme (`GameContext`)

Le jeu n'importe jamais `@/lib/supabase` : tout passe par `ctx`.

| Appel                       | Usage dans le Sudoku                                              |
|-----------------------------|-------------------------------------------------------------------|
| `ctx.submitScore`           | Envoie le score à la fin d'une grille résolue                     |
| `ctx.getLeaderboard`        | Affiche le top 10                                                 |
| `ctx.getMyBest`             | Affiche « Ton meilleur score »                                    |
| `ctx.save` / `ctx.loadSave` | Sauvegarde la partie toutes les 5 s, bouton « Reprendre ma partie » |
| `ctx.clearSave`             | Efface la sauvegarde quand la grille est terminée                 |

**Mode invité** (`ctx.player === null`) : le jeu reste jouable, le score n'est pas enregistré, la
sauvegarde est locale au navigateur, et un message invite à se connecter.

### Base de données

La migration `supabase/migrations/20261102145517_add_game_sudoku.sql` insère le jeu dans `public.games`
avec `category = 'solo'`, identique à `index.ts`.

## Backend (Spring Boot)

Package `fr.tikigaming.sudoku`, sans état (rien n'est stocké côté serveur).

### Classes

| Classe             | Rôle                                                                              |
|--------------------|-----------------------------------------------------------------------------------|
| `Difficulty`       | Niveaux `EASY`, `MEDIUM`, `HARD` : nombre d'indices, score de base, temps de référence ; `parse()` |
| `SudokuSolver`     | Règles : validation d'un placement, résolution, comptage de solutions, conflits  |
| `SudokuGenerator`  | Génère une grille à solution unique ; accepte un `Random` à graine fixe pour les tests |
| `ScoreCalculator`  | Règles métier du score (fonction pure)                                            |
| `ScoreBreakdown`   | Détail du score : base, bonus de temps, bonus sans faute, pénalité, total         |
| `SudokuService`    | Vérifie une partie (forme des grilles, indices intacts, conflits) et calcule le score |
| `SudokuController` | Les endpoints REST, documentés dans OpenAPI (tag « Sudoku »)                      |
| `Clock`, `CurrencyConverter`, `AuditNotifier` | Contrats purs sans I/O (voir [Contrats d'abstraction](#contrats-dabstraction)) |
| `Ledger`, `LedgerEntry`, `RewardService` | Registre des pièces et service qui convertit un score en pièces (voir [Récompense en pièces](#récompense-en-pièces)) |

### API

| Méthode | Chemin                                  | Rôle                                                          |
|---------|-----------------------------------------|---------------------------------------------------------------|
| `GET`   | `/api/sudoku/puzzle?difficulty=easy`    | Nouvelle grille (`easy`, `medium`, `hard`). **La solution n'est jamais renvoyée.** |
| `POST`  | `/api/sudoku/check`                     | Vérifie une partie et calcule le score                        |

`GET /api/sudoku/puzzle` renvoie :

```json
{ "difficulty": "medium", "puzzle": [0, 3, 0, 0, 7, "… 81 valeurs, 0 = case vide"] }
```

`POST /api/sudoku/check` reçoit :

```json
{
  "difficulty": "easy",
  "puzzle": [ "… 81 valeurs de départ" ],
  "values": [ "… 81 valeurs du joueur" ],
  "seconds": 540,
  "mistakes": 0
}
```

et renvoie `complete`, `solved`, `conflicts` (indices des cases en doublon), `score` et `breakdown`.
Une entrée invalide (grille de mauvaise taille, chiffre hors 0 à 9, indice de départ modifié, valeurs
négatives, difficulté inconnue) donne un **400** avec `{ "error": "…" }`.

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
| `Clock`             | `Instant now()`                              | `SystemClock` (production) ; `FixedClock` (tests, avancée à la main) |
| `CurrencyConverter` | `BigDecimal convert(amount, from, to)`       | `FixedRateCurrencyConverter` : taux fixes en mémoire, passage par une devise de référence, arrondi à 2 décimales (au pair), refus des montants négatifs et des devises inconnues |
| `AuditNotifier`     | `void notify(AuditEvent event)`              | `RecordingAuditNotifier` (tests) : garde les événements en mémoire, dans l'ordre |

`AuditEvent` est un record immuable (type, date, détails copiés à la création) ; il refuse un type vide
ou une date manquante. `Clock` n'est pas `java.time.Clock` : attention à l'import si les deux servent
dans la même classe.

### Récompense en pièces

`RewardService` est le premier code qui s'appuie sur les contrats : pour un joueur et un score, il
convertit les points (`PTS`) en pièces (`TIKI`) avec `CurrencyConverter`, inscrit une ligne dans le
`Ledger` (registre) à l'heure donnée par `Clock`, puis envoie un événement `REWARD_GRANTED` à
`AuditNotifier`. Il renvoie les pièces créditées.

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
| `SudokuControllerTest`    | Réponses et erreurs 400, en appelant le controller comme un objet Java |
| `ClockTest`               | Horloge figée, avancée à la main, calcul d'une durée                 |
| `FixedRateCurrencyConverterTest` | Conversion via la référence, arrondi, devise inconnue, montant négatif |
| `AuditNotifierTest`       | Ordre des événements, immutabilité des détails, entrées invalides    |
| `RewardServiceTest`       | Conversion au taux figé, registre, audit, solde, entrées invalides, échec de conversion |

**Doubles de test** (en RAM, dans `src/test`), tous sans I/O :

| Double                  | Type | Rôle                                                                   |
|-------------------------|------|------------------------------------------------------------------------|
| `StubCurrencyConverter` | Stub | Taux de change figé (ex. 1 PTS = 0,01 TIKI) ; refuse toute autre paire de devises |
| `InMemoryLedger`        | Fake | Vrai registre fonctionnel, stocké dans une liste                      |
| `FixedClock`            | Stub | Heure figée, avancée à la main                                         |
| `RecordingAuditNotifier`| Spy  | Garde les événements reçus pour les vérifier                           |

Exigences : logique pure, aucun accès réseau ni disque, pas de contexte Spring. Le seul aléa est un
`Random` à graine fixe. Les tests à backtracking (générateur, solveur) prennent quelques dizaines de ms
à froid.

Dans l'historique, la règle « valeur vide = manquante » est faite en cycle TDD : un commit `test`
(rouge), un commit `fix` (vert), un commit `refactor`.

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

## Écarts connus

- **Le frontend n'utilise pas l'API.** Il génère sa grille dans `logic.ts` et calcule son score avec
  l'ancienne formule : `base − secondes − 50 × erreurs`. Les scores affichés ne suivent donc pas les
  règles du backend (paliers, bonus sans faute, plafond).
- **Le score envoyé par `ctx.submitScore` reste décidé par le client** : un joueur peut envoyer un
  score sans passer par `/api/sudoku/check`.

Pour fermer ces deux écarts, il faut que `SudokuGame.tsx` récupère la grille sur `/api/sudoku/puzzle`
et envoie la partie sur `/api/sudoku/check`, puis utilise le `score` renvoyé.
