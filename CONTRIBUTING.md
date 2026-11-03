# Contribuer à Tiki Gaming

## Branches

| Branche | Rôle                                                                                   |
|---------|----------------------------------------------------------------------------------------|
| `dev`   | Branche d'intégration : **toutes les issues et toutes les pull requests ciblent `dev`** |
| `main`  | Branche de production, mise à jour uniquement par une PR `dev` → `main` (équipe plateforme) |

**On ne pousse jamais directement sur `dev` ni sur `main`** : tout passe par une pull request.

### Issues

- Chaque tâche ou bug fait l'objet d'une issue avant le développement ; l'issue décrit le travail à
  livrer sur `dev`.
- **La spécification doit exister sur l'issue avant de commencer le développement** : ce qui doit
  être livré (checklist de tâches, règles à implémenter, critères d'acceptation), pas seulement un
  titre. Une issue vide ou trop vague se complète avant de coder.
- La PR référence son issue dans sa description (`Closes #12`). `dev` n'étant pas la branche par
  défaut, GitHub ne ferme pas l'issue à la fusion dans `dev` : **une fois la PR validée et fusionnée,
  fermer l'issue comme complétée** (*Close as completed*, ou `gh issue close 12 --reason completed`),
  après avoir coché les cases de sa checklist. *Close as not planned* est réservé aux issues abandonnées.

### Nommage

| Préfixe                    | Usage                                         | Exemple                         |
|----------------------------|-----------------------------------------------|---------------------------------|
| `game/<slug>/<sujet>`      | Travail sur un jeu (une équipe = son slug)    | `game/snake/ajout-niveaux`      |
| `feat/<sujet>`             | Nouvelle fonctionnalité plateforme            | `feat/avatars`                  |
| `fix/<sujet>`              | Correction de bug                             | `fix/reset-password-redirect`   |
| `db/<sujet>`               | Migration de base de données                  | `db/table-achievements`         |
| `chore/<sujet>`            | Outillage, dépendances, CI, docs              | `chore/maj-dependances`         |

En minuscules, mots séparés par des tirets, sans accents.

### Workflow

1. Partir de `dev` à jour : `git switch dev && git pull && git switch -c game/mon-jeu/premiere-version`
2. Faire des commits petits et explicites (voir ci-dessous).
3. Avant de pousser, les vérifications de la partie modifiée doivent passer (la CI les relance sur la PR) :
   - front, dans `frontend/` : `npm run format && npm run lint && npm test && npm run build` ;
   - backend, dans `backend/` : `mvn spotless:apply` puis `mvn verify` (voir [Backend](#backend)).
4. Ouvrir une pull request vers `dev` (jamais vers `main`), la garder courte et ciblée (un sujet par PR).
   **Tant que le travail n'est pas terminé, la PR est en draft** (`gh pr create --draft`, ou
   *Convert to draft* / `gh pr ready 12 --undo` sur une PR déjà ouverte). Une draft ne se relit pas et ne
   se fusionne pas : la passer en *Ready for review* (`gh pr ready 12`) quand tout est livré et la CI verte,
   et la repasser en draft si un retour de relecture demande encore du travail.
5. **CI verte et 1 relecture approuvée minimum** avant de fusionner :
   - une PR qui ne touche que `frontend/src/games/<slug>/` (+ sa migration d'ajout au catalogue) peut
     être relue par l'équipe du jeu ;
   - une PR qui touche le package serveur d'un jeu (`backend/.../games/<slug>/`) doit aussi être relue
     par l'équipe plateforme : ce code s'exécute avec les secrets du serveur ;
   - une PR qui touche la plateforme (`backend/`, `frontend/src/auth`, `frontend/src/lib`,
     `frontend/src/games/sdk.ts`, `frontend/src/games/types.ts`, `frontend/src/pages`, `supabase/`) doit
     être relue par l'équipe plateforme.
6. Fusion en **squash merge**, puis :
   - fermer l'issue comme complétée (voir [Issues](#issues)) ;
   - **supprimer la branche** sur GitHub (*Delete branch* après la fusion, ou `gh pr merge 12 --squash
     --delete-branch`) et en local : `git switch dev && git pull && git branch -D <branche>`
     (`-D` car le squash merge ne garde pas les commits de la branche).
7. Garder sa branche à jour avec `dev` (`git pull --rebase origin dev`) plutôt que de laisser
   s'accumuler les conflits.

### Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/), avec le numéro de l'issue
liée entre parenthèses en fin de description :

```
<type>(<portée>): <description à l'impératif> (#<numéro-issue>)

feat(snake): ajoute le mode chrono (#12)
fix(auth): corrige la redirection après reset du mot de passe (#15)
db: ajoute la table achievements (#9)
```

Types : `feat`, `fix`, `db`, `refactor`, `docs`, `chore`, `style`, `test`, `ci`. La portée est le slug du
jeu (front comme backend) ou la zone de la plateforme : `auth`, `sdk`, `ui` pour le front, `backend`
pour le serveur Java (`fix(backend): corrige l'expiration du JWT (#21)`). Chaque commit doit référencer l'issue sur
laquelle il travaille : le `#<numéro>` est obligatoire, même sur un commit intermédiaire.

### Migrations de base de données

- Une migration = un fichier `supabase/migrations/<timestamp>_<nom>.sql` (créé avec
  `npx supabase migration new <nom>`), **jamais modifié une fois fusionné** : on corrige par une
  nouvelle migration.
- Toute nouvelle table doit activer la RLS et déclarer ses droits explicitement.
- Les migrations sont appliquées en production par l'équipe plateforme après la fusion.

### Secrets

Ne jamais committer `.env`, de mot de passe ni de clé `service_role`. Seules les variables
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` sont destinées au front (`frontend/.env`). Les secrets
serveur (Google OAuth, `SUPABASE_JWT_SECRET`, clé `service_role`) vont uniquement dans `backend/.env`
(modèle : `backend/.env.example`) et ne sont jamais lus par le front.

## Front

| Commande               | Rôle                                                                  |
|------------------------|-----------------------------------------------------------------------|
| `npm run format`       | **Formatter** : reformate le code (Prettier, `.prettierrc.json`)       |
| `npm run format:check` | Vérifie le formatage sans rien modifier (utilisé par la CI)           |
| `npm run lint`         | **Linter** : ESLint (TypeScript, règles des hooks React)              |
| `npm run build`        | Vérification des types + build de production                          |
| `npm test`             | Tests unitaires et de composants (Vitest), fichiers `*.test.ts(x)` à côté du code testé |
| `npm run test:mutation`| **Mutation testing** (Stryker) du cœur de la plateforme ; échoue sous 75 % (rapport : `reports/mutation/`) |
| `npm run test:e2e`     | **E2E** (Playwright, Chromium) : parcours du lobby et audit d'accessibilité axe ; `npx playwright install chromium` la première fois |
| `npm run test:integration` | **Tests d'intégration** (Testcontainers, Docker requis) : migrations, RLS et catalogue sur une vraie base |

Lancer `npm run format` avant chaque commit : la CI refuse un code non formaté. Comme pour le backend,
c'est le formatter qui tranche les questions de style.

### Validation et erreurs

- Les règles des formulaires sont des schémas **Zod** (`zod/mini`, léger pour le navigateur) dans
  `src/lib/validation.ts`, testés dans `validation.test.ts`. Les formulaires sont en `noValidate` : pas
  de bulle du navigateur, le message s'affiche sous le champ avec le composant `Field`.
- Un message d'erreur dit **quoi corriger** (« Caractère non autorisé : ' — … »), sans code technique.
- Toute règle existe aussi côté backend (Bean Validation) avec le même message : le front n'est pas une
  sécurité. Le backend renvoie `{ error, fields: { champ: message } }` ; `toFormErrors()` (`src/lib/api.ts`)
  place chaque message sous son champ.

### Tests

- **Unitaires** (`*.test.ts`) : logique pure, sans réseau ni stockage réel, quelques millisecondes par test.
  Une ligne par partition et par frontière (`test.each`), au format Arrange / Act / Assert.
- **Composants** (`*.test.tsx`, `// @vitest-environment jsdom` en tête de fichier) : Testing Library,
  on vérifie ce que le joueur voit (texte, rôles ARIA), pas l'implémentation.
- Le SDK des jeux se teste avec les **fakes** de `src/games/testing/fakes.ts` (`fakeDeps()`) : scores,
  sauvegardes et stockage en mémoire, pannes simulées avec `FakeScores.failNext()`. Pas de mock de Supabase.
- **Intégration** (`tests/integration/`) : un conteneur `supabase/postgres` (même version que la prod) est
  démarré une fois pour la suite, les migrations du dépôt y sont rejouées, puis chaque test tourne dans une
  transaction annulée à la fin. `as(db, userId, …)` exécute une requête avec les droits d'un joueur
  (`authenticated` + JWT) ou d'un visiteur (`anon`, `userId` à `null`) : c'est la RLS réelle qui est testée.
  **Toute nouvelle table ou politique RLS arrive avec ses tests d'intégration.** Sans Docker, ces tests sont
  ignorés en local (la CI, elle, échoue).
- **BDD** (`src/games/features/*.feature`, en français) : les règles métier du lobby (classement, scores)
  écrites en Gherkin et exécutées par `npm test` (vitest-cucumber). Les étapes (`*.steps.test.ts`) appellent
  le domaine et le SDK avec ses fakes, **jamais l'interface** : un scénario ne casse pas quand l'UI change.
- **E2E** (`e2e/`) : peu de tests, réservés aux parcours vitaux (accueil → jeu → partie, panne, redirection)
  et à l'audit axe. Backend et Supabase sont simulés (`e2e/fixtures.ts`) ; le temps est contrôlé avec
  `page.clock` (pas d'attente réelle de 10 s). Aucune violation WCAG sérieuse ou critique n'est tolérée.
- Mutation testing : un mutant survivant se tue par un test. S'il est équivalent (journalisation…), on le
  désactive sur la ligne avec sa justification : `// Stryker disable next-line all: journalisation seule`.

### Logs

Pas de `console.*` : utiliser `logger` (**Pino**, `src/lib/logger.ts`) avec l'erreur en premier argument,
`logger.error({ err }, 'Ce qui a échoué')`. Jamais de mot de passe ni de jeton dans un log.

## Backend

Java 21 · Spring Boot · Maven, dans `backend/`. Voir [docs/architecture.md](docs/architecture.md#backend).

### Outillage

| Commande                 | Rôle                                                                     |
|--------------------------|--------------------------------------------------------------------------|
| `mvn spotless:apply`     | **Formatter** : reformate le code (palantir-java-format, 4 espaces, 120 colonnes) |
| `mvn checkstyle:check`   | **Linter** : imports inutiles, nommage, accolades, erreurs probables (`checkstyle.xml`) |
| `mvn test`               | Tests unitaires (JUnit 5 + AssertJ + MockMvc)                            |
| `mvn verify`             | Tout à la fois : linter, compilation, tests, et échec si le code n'est pas formaté |
| `mvn -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage` | **Mutation testing** (Pitest) ; échoue sous 75 % (rapport : `target/pit-reports/`) |
| `mvn spring-boot:run`    | Lance le serveur sur http://localhost:8080 (lit `backend/.env`)          |

Une fois le serveur lancé, l'API est documentée et testable sur **http://localhost:8080/swagger-ui.html**
(voir [docs/architecture.md](docs/architecture.md#swagger-openapi)).

Lancer `mvn spotless:apply` avant chaque commit : la CI refuse un code non formaté. Le style n'est pas
négociable en relecture, c'est le formatter qui tranche. Une règle du linter qui gêne se discute dans une
PR `chore/` qui modifie `checkstyle.xml`, pas avec des `@SuppressWarnings` au cas par cas.

### Validation et erreurs

- Les corps de requête sont des `record` annotés (Bean Validation : `@NotBlank`, `@Size`, `@Email`, ou une
  contrainte maison comme `@Username`) et reçus avec `@Valid` ; les messages, en français, sont les mêmes
  que ceux du front.
- Les erreurs sont mises en forme par `config/ApiExceptionHandler` : `400 { error, fields }` pour une saisie
  refusée, `502` si Supabase échoue, `500` générique pour le reste. Pas de `@ExceptionHandler` dans les
  contrôleurs, et jamais de détail technique dans la réponse.

### Logs

SLF4J (`LoggerFactory.getLogger(MaClasse.class)`), avec Logback fourni par Spring Boot. Une erreur
inattendue se logue avec son exception en dernier argument (`log.error("…", e)`) pour garder la trace.
`LOG_LEVEL` règle le niveau des logs `fr.tikigaming` ; en production, `LOGGING_STRUCTURED_FORMAT_CONSOLE=ecs`
les écrit en JSON. Jamais de mot de passe, de jeton ni de clé dans un log.

### Packages

```
fr.tikigaming
├── config/          Configuration Spring (sécurité, propriétés)      → équipe plateforme
├── auth/            Authentification et session                      → équipe plateforme
└── games/
    └── <slug>/      Code serveur d'un jeu (ex. games/mon_jeu/)       → équipe du jeu + plateforme
```

- Comme côté front, chaque jeu qui a besoin du serveur (validation de score, multijoueur, logique
  anti-triche…) a **son propre package** `fr.tikigaming.games.<slug>`, le slug étant écrit avec des `_`
  à la place des tirets (`mon-jeu` → `mon_jeu`). Ses tests vont dans le même package sous `src/test/java`.
- Ses endpoints sont préfixés par le slug : `/api/games/<slug>/...`.
- Ils apparaissent automatiquement dans Swagger. Chaque contrôleur porte `@Tag(name = "<slug>")` et
  chaque endpoint un `@Operation(summary = "...")` ainsi que ses `@ApiResponse` (codes d'erreur
  compris), sur le modèle d'`AuthController`. Pas de secret ni de vraie donnée utilisateur dans les
  exemples (`@Schema(example = ...)`).
- Un jeu **n'importe jamais** le package d'un autre jeu. Ce qui sert à plusieurs jeux est ajouté à la
  plateforme (nouveau package hors de `games/`), comme pour le SDK du front.
- Un jeu sans logique serveur n'a pas de package backend : tout passe par le `GameContext` et Supabase.
- Spring Boot 4 utilise **Jackson 3** : importer `tools.jackson.databind.*` (`JsonNode`, `ObjectMapper`),
  jamais `com.fasterxml.jackson.databind.*`. Ce dernier compile, car springdoc l'embarque, mais l'application
  ne démarre pas (pas de bean `ObjectMapper` Jackson 2). Les annotations `com.fasterxml.jackson.annotation.*`
  (`@JsonInclude`…) restent valables.
- Même [approche TDD](#approche-tdd) que côté front : le test de la règle (validation, calcul,
  sécurité) s'écrit avant son implémentation.

## Intégration continue

`.github/workflows/ci.yml` s'exécute sur chaque PR et chaque push vers `dev` et `main`. Un job ne tourne
que si sa zone a changé ; sinon il apparaît « skipped », ce qui compte comme réussi pour la fusion :

| Job                 | Tourne si                         | Étapes                                             |
|---------------------|-----------------------------------|----------------------------------------------------|
| `frontend`          | `frontend/**`                     | `npm ci` → `npm run format:check` → `npm run lint` → `npm test` → `npm run build` |
| `backend`           | `backend/**`                      | `mvn -B verify` (linter, compilation, tests, format) |
| `integration`       | `frontend/**` ou `supabase/**`    | `npm run test:integration` : Testcontainers, migrations et RLS sur PostgreSQL réel |
| `mutation-frontend` | `frontend/**`                     | `npm run test:mutation` (Stryker, seuil 75 %), rapport en artefact |
| `mutation-backend`  | `backend/**`                      | Pitest (seuil 75 %), rapport en artefact |
| `e2e`               | `frontend/**`                     | `npm run test:e2e` : Playwright + audit WCAG 2.1 AA (axe), rapport en artefact en cas d'échec |
| `security`          | toujours                          | `npm audit --audit-level=high` ; sur une PR, *dependency review* (nouvelle dépendance vulnérable refusée) |

Modifier `.github/workflows/ci.yml` relance tous les jobs. Si le job `changes` (détection des zones)
échoue, tous les jobs tournent aussi.

### Caches

| Cache | Effet |
|-------|-------|
| npm, Maven | dépendances téléchargées une fois (`setup-node`, `setup-java`) |
| Prettier, ESLint | seuls les fichiers dont le **contenu** a changé sont revérifiés (aussi en local : `node_modules/.cache`) |
| Playwright | navigateurs réinstallés seulement quand la version change |
| Stryker, Pitest | **sur une PR**, seuls les mutants concernés par le changement sont rejoués ; un push vers `dev` ou `main` refait un run **complet**, qui sert de référence aux PR suivantes |

Les seuils et le résultat des checks ne changent pas : un test affaibli fait toujours apparaître ses
mutants survivants, en incrémental comme en complet. En cas de doute sur un résultat de mutation d'une
PR, supprimer ses caches `stryker-…` / `pitest-…` (onglet *Actions → Caches*) puis relancer le job :
*Re-run* seul relit le cache.

`.github/workflows/codeql.yml` lance en plus l'analyse de sécurité **CodeQL** (TypeScript et Java) sur
chaque PR, chaque push et chaque lundi ; les alertes sont dans l'onglet *Security* du dépôt.

Une PR ne se fusionne qu'avec une CI verte.
Les noms des jobs (`Frontend (format + lint + build)`, `Backend (format + lint + tests)`) sont des checks
**obligatoires** de la protection de `dev` et `main` : ne pas les renommer sans mettre à jour la règle
dans *Settings → Rules*, sinon les PR restent bloquées en attente d'un check qui n'arrive jamais.

### Dependabot

`.github/dependabot.yml` vérifie chaque lundi les dépendances du front (`frontend/`, npm) et du backend
(`backend/`, Maven) et ouvre des PR vers `dev` :

- les mises à jour mineures et correctifs sont regroupés en **une PR par partie et par semaine** ;
- chaque version majeure a sa propre PR : lire les notes de version, elle peut demander des adaptations ;
- elles suivent les mêmes règles que les autres PR (CI verte, relecture par l'équipe plateforme, squash
  merge). Une PR Dependabot n'a pas d'issue liée : c'est la seule exception à la règle des issues.

## Créer un jeu

Chaque jeu est un module React autonome dans `frontend/src/games/<slug>/`. La plateforme gère le compte,
la connexion, la navigation ; le jeu reçoit un objet `ctx` (`GameContext`) pour parler au backend.

### 1. Copier le template

```bash
cp -r frontend/src/games/clicker frontend/src/games/mon-jeu
```

`slug` : minuscules, chiffres et tirets (`mon-jeu`). Il sert d'URL (`/games/mon-jeu`) et de clé en base.

### 2. Déclarer le jeu

`frontend/src/games/mon-jeu/index.ts`

```ts
import { lazy } from 'react'
import type { GameDefinition } from '../types'

const monJeu: GameDefinition = {
  slug: 'mon-jeu',
  title: 'Mon Jeu',
  description: 'Une phrase de présentation.',
  category: 'duel',        // obligatoire : 'solo' (1 joueur) · 'duel' (2) · 'multi' (3 et +)
  mode: 'solo',            // accès : 'solo' = jouable sans compte · 'multiplayer' = connexion obligatoire
  thumbnail: '/games/mon-jeu/thumbnail.webp', // optionnel, fichier dans frontend/public/games/mon-jeu/
  scoreLimits: { max: 5000 }, // optionnel : score maximal plausible, refusé au-delà (aligné avec games.max_score)
  component: lazy(() => import('./MonJeu')),
}
export default monJeu
```

La **catégorie** décrit le format de jeu, le **mode** dit seulement si un compte est nécessaire. Les
deux sont indépendants : un jeu d'échecs contre une IA peut être `category: 'duel'` et `mode: 'solo'`.
La liste des catégories est dans `frontend/src/games/categories.ts` ; en ajouter une passe par
l'équipe plateforme (voir [docs/architecture.md](docs/architecture.md#catégories)).

Puis l'ajouter dans `frontend/src/games/registry.ts` :

```ts
import monJeu from './mon-jeu'
export const games: GameDefinition[] = [clicker, monJeu]
```

### 3. L'enregistrer en base

```bash
npx supabase migration new add_game_mon_jeu
```

```sql
insert into public.games (slug, title, description, category)
values ('mon-jeu', 'Mon Jeu', 'Une phrase de présentation.', 'duel');
```

Sans cette ligne, l'envoi de score et la sauvegarde sont refusés (clé étrangère + RLS). La
`category` est obligatoire et doit être la même que dans `index.ts`.

### 4. Utiliser le `GameContext`

```tsx
import type { GameProps } from '../types'

export default function MonJeu({ ctx }: GameProps) {
  ctx.player                     // { id, username } du joueur connecté, ou null en invité
  ctx.isGuest                    // true si jeu solo lancé sans compte
  await ctx.submitScore(1200, { level: 3 })   // fin de partie ; plus haut = meilleur. false en invité
  await ctx.getLeaderboard(10)   // top 10 (meilleur score par joueur)
  await ctx.getMyBest()          // meilleur score du joueur, ou null
  await ctx.save({ level: 3 })   // sauvegarde JSON (écrase la précédente)
  await ctx.loadSave(saveSchema) // validée par un schéma Zod : null si absente, corrompue ou d'un ancien format
  await ctx.clearSave()
}
```

#### Erreurs

Les méthodes du `ctx` rejettent avec une `GameError` (`src/games/errors.ts`) dont le **`message` est écrit
pour le joueur** : l'afficher tel quel (`setError(e.message)`), sans code technique. `e.code` permet
d'adapter la réaction :

| `code`      | Cas                                                        |
|-------------|------------------------------------------------------------|
| `invalid`   | score refusé avant l'envoi (pas un entier, négatif, au-dessus de `scoreLimits.max`) |
| `queued`    | coupure réseau : le score est gardé sur l'appareil et renvoyé à la prochaine partie (5 essais) |
| `network`   | serveur injoignable (lecture du classement, sauvegarde…) : réessayer plus tard |
| `session`   | session expirée : se reconnecter                           |
| `forbidden` / `not_found` | refusé par la RLS, ou jeu absent de `public.games` |

Si le jeu plante pendant son rendu, la plateforme l'isole (`GameErrorBoundary`) : le joueur voit un
message et un bouton « Relancer le jeu », le reste du site continue de fonctionner.

### Mode invité (jeux `solo`)

Un jeu `solo` doit fonctionner sans compte. En invité, le `ctx` a la même API mais :

| Méthode          | Connecté                 | Invité                                  |
|------------------|--------------------------|-----------------------------------------|
| `submitScore`    | enregistré, renvoie true | ignoré, renvoie false                   |
| `getLeaderboard` | classement public        | classement public                       |
| `getMyBest`      | meilleur score           | null                                    |
| `save/loadSave`  | en base (Supabase)       | `localStorage` du navigateur            |

Pensez à gérer `ctx.player === null` (affichage du pseudo, etc.) et, en fin de partie, à inviter le
joueur à se connecter pour être classé (voir le clicker).

### Approche TDD

**On développe en TDD : le test de la règle de jeu s'écrit avant son implémentation.**

1. Écrire un test qui décrit le comportement attendu (une règle du jeu, un cas limite) — il doit
   échouer puisque rien n'est implémenté.
2. Écrire le minimum de code pour le faire passer.
3. Refactorer si besoin, tests toujours au vert.
4. Recommencer pour la règle suivante.

Priorité aux règles du jeu et à la logique métier (calcul du score, conditions de victoire, coups
valides…) plutôt qu'au rendu visuel. Pour tester un composant qui reçoit `ctx` sans réseau :

```ts
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'

const scores = new FakeScores({ id: 'p1', username: 'alice' })
const ctx = createGameContext(monJeu, { id: 'p1', username: 'alice' }, fakeDeps({ scores }))
scores.failNext(new GameError('network', 'hors ligne')) // simule une coupure au prochain envoi
```

### Règles

- **Ne pas importer `@/lib/supabase` dans un jeu.** Tout passe par `ctx`. Si une fonctionnalité manque
  (multijoueur temps réel, succès, inventaire…), on l'ajoute au SDK pour tous les jeux.
- Le jeu ne touche pas au routing ni à l'auth : la page de jeu applique la règle du `mode` (solo / multijoueur).
- Code et assets du jeu restent dans `frontend/src/games/<slug>/` (ou `frontend/public/games/<slug>/`).
- Interface : suivre la [charte graphique](docs/charte-graphique.md) (tokens de couleur, composants,
  CSS du jeu préfixé par le slug, tutoiement).
- Le jeu est chargé à la demande (`lazy`) : les dépendances lourdes (Phaser, Three.js…) n'alourdissent pas la plateforme.
- Besoin de tables propres au jeu ? Les préfixer par le slug (`mon_jeu_xxx`), activer la RLS, et
  passer en revue avec l'équipe plateforme.
- Avant de pousser (dans `frontend/`) : `npm run format && npm run lint && npm test && npm run build`.
