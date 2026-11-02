# Contribuer à Tiki Gaming

## Branches

`main` est la branche de production : **on ne pousse jamais directement dessus**. Tout passe par une
pull request.

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

1. Partir de `main` à jour : `git switch main && git pull && git switch -c game/mon-jeu/premiere-version`
2. Faire des commits petits et explicites (voir ci-dessous).
3. Avant de pousser : `npm run lint && npm run build` doivent passer.
4. Ouvrir une pull request vers `main`, la garder courte et ciblée (un sujet par PR).
5. **1 relecture approuvée minimum** avant de fusionner :
   - une PR qui ne touche que `src/games/<slug>/` (+ sa migration d'ajout au catalogue) peut être
     relue par l'équipe du jeu ;
   - une PR qui touche la plateforme (`src/auth`, `src/lib`, `src/games/sdk.ts`, `src/games/types.ts`,
     `src/pages`, `supabase/`) doit être relue par l'équipe plateforme.
6. Fusion en **squash merge**, puis suppression de la branche.
7. Garder sa branche à jour avec `main` (`git pull --rebase origin main`) plutôt que de laisser
   s'accumuler les conflits.

### Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<portée>): <description à l'impératif>

feat(snake): ajoute le mode chrono
fix(auth): corrige la redirection après reset du mot de passe
db: ajoute la table achievements
```

Types : `feat`, `fix`, `db`, `refactor`, `docs`, `chore`, `style`, `test`. La portée est le slug du
jeu ou la zone de la plateforme (`auth`, `sdk`, `ui`…).

### Migrations de base de données

- Une migration = un fichier `supabase/migrations/<timestamp>_<nom>.sql` (créé avec
  `npx supabase migration new <nom>`), **jamais modifié une fois fusionné** : on corrige par une
  nouvelle migration.
- Toute nouvelle table doit activer la RLS et déclarer ses droits explicitement.
- Les migrations sont appliquées en production par l'équipe plateforme après la fusion.

### Secrets

Ne jamais committer `.env`, de mot de passe ni de clé `service_role`. Seules les variables
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` sont destinées au front.

## Créer un jeu

Chaque jeu est un module React autonome dans `src/games/<slug>/`. La plateforme gère le compte,
la connexion, la navigation ; le jeu reçoit un objet `ctx` (`GameContext`) pour parler au backend.

### 1. Copier le template

```bash
cp -r src/games/clicker src/games/mon-jeu
```

`slug` : minuscules, chiffres et tirets (`mon-jeu`). Il sert d'URL (`/games/mon-jeu`) et de clé en base.

### 2. Déclarer le jeu

`src/games/mon-jeu/index.ts`

```ts
import { lazy } from 'react'
import type { GameDefinition } from '../types'

const monJeu: GameDefinition = {
  slug: 'mon-jeu',
  title: 'Mon Jeu',
  description: 'Une phrase de présentation.',
  mode: 'solo',            // 'solo' = jouable sans compte · 'multiplayer' = connexion obligatoire
  thumbnail: '/thumbnails/mon-jeu.png', // optionnel, fichier dans public/
  component: lazy(() => import('./MonJeu')),
}
export default monJeu
```

Puis l'ajouter dans `src/games/registry.ts` :

```ts
import monJeu from './mon-jeu'
export const games: GameDefinition[] = [clicker, monJeu]
```

### 3. L'enregistrer en base

```bash
npx supabase migration new add_game_mon_jeu
```

```sql
insert into public.games (slug, title, description)
values ('mon-jeu', 'Mon Jeu', 'Une phrase de présentation.');
```

Sans cette ligne, l'envoi de score et la sauvegarde sont refusés (clé étrangère + RLS).

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

### Règles

- **Ne pas importer `@/lib/supabase` dans un jeu.** Tout passe par `ctx`. Si une fonctionnalité manque
  (multijoueur temps réel, succès, inventaire…), on l'ajoute au SDK pour tous les jeux.
- Le jeu ne touche pas au routing ni à l'auth : la page de jeu applique la règle du `mode` (solo / multijoueur).
- Code et assets du jeu restent dans `src/games/<slug>/` (ou `public/games/<slug>/`).
- Le jeu est chargé à la demande (`lazy`) : les dépendances lourdes (Phaser, Three.js…) n'alourdissent pas la plateforme.
- Besoin de tables propres au jeu ? Les préfixer par le slug (`mon_jeu_xxx`), activer la RLS, et
  passer en revue avec l'équipe plateforme.
- Avant de pousser : `npm run lint && npm run build`.
