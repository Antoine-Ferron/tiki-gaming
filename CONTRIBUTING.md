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
  défaut, GitHub ne ferme pas l'issue à la fusion dans `dev` : la fermer à la main une fois la PR fusionnée.

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
   - front, dans `frontend/` : `npm run format && npm run lint && npm run build` ;
   - backend, dans `backend/` : `mvn spotless:apply` puis `mvn verify` (voir [Backend](#backend)).
4. Ouvrir une pull request vers `dev` (jamais vers `main`), la garder courte et ciblée (un sujet par PR).
5. **CI verte et 1 relecture approuvée minimum** avant de fusionner :
   - une PR qui ne touche que `frontend/src/games/<slug>/` (+ sa migration d'ajout au catalogue) peut
     être relue par l'équipe du jeu ;
   - une PR qui touche le package serveur d'un jeu (`backend/.../games/<slug>/`) doit aussi être relue
     par l'équipe plateforme : ce code s'exécute avec les secrets du serveur ;
   - une PR qui touche la plateforme (`backend/`, `frontend/src/auth`, `frontend/src/lib`,
     `frontend/src/games/sdk.ts`, `frontend/src/games/types.ts`, `frontend/src/pages`, `supabase/`) doit
     être relue par l'équipe plateforme.
6. Fusion en **squash merge**, puis suppression de la branche.
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

Lancer `npm run format` avant chaque commit : la CI refuse un code non formaté. Comme pour le backend,
c'est le formatter qui tranche les questions de style.

## Backend

Java 21 · Spring Boot · Maven, dans `backend/`. Voir [docs/architecture.md](docs/architecture.md#backend).

### Outillage

| Commande                 | Rôle                                                                     |
|--------------------------|--------------------------------------------------------------------------|
| `mvn spotless:apply`     | **Formatter** : reformate le code (palantir-java-format, 4 espaces, 120 colonnes) |
| `mvn checkstyle:check`   | **Linter** : imports inutiles, nommage, accolades, erreurs probables (`checkstyle.xml`) |
| `mvn test`               | Tests unitaires (JUnit 5 + AssertJ)                                      |
| `mvn verify`             | Tout à la fois : linter, compilation, tests, et échec si le code n'est pas formaté |
| `mvn spring-boot:run`    | Lance le serveur sur http://localhost:8080 (lit `backend/.env`)          |

Une fois le serveur lancé, l'API est documentée et testable sur **http://localhost:8080/swagger-ui.html**
(voir [docs/architecture.md](docs/architecture.md#swagger-openapi)).

Lancer `mvn spotless:apply` avant chaque commit : la CI refuse un code non formaté. Le style n'est pas
négociable en relecture, c'est le formatter qui tranche. Une règle du linter qui gêne se discute dans une
PR `chore/` qui modifie `checkstyle.xml`, pas avec des `@SuppressWarnings` au cas par cas.

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
- Même [approche TDD](#approche-tdd) que côté front : le test de la règle (validation, calcul,
  sécurité) s'écrit avant son implémentation.

## Intégration continue

`.github/workflows/ci.yml` s'exécute sur chaque PR et chaque push vers `dev` et `main` :

| Job        | Étapes                                             |
|------------|----------------------------------------------------|
| `frontend` | `npm ci` → `npm run format:check` → `npm run lint` → `npm run build` |
| `backend`  | `mvn -B verify` (linter, compilation, tests, format) |

Une PR ne se fusionne qu'avec une CI verte.

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
  await ctx.loadSave<MaSave>()   // ou null
  await ctx.clearSave()
}
```

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
valides…) plutôt qu'au rendu visuel.

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
- Avant de pousser (dans `frontend/`) : `npm run format && npm run lint && npm run build`.
