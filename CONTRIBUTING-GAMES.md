# Créer un jeu sur Tiki Gaming

Chaque jeu est un module React autonome dans `src/games/<slug>/`. La plateforme gère le compte,
la connexion, la navigation ; le jeu reçoit un objet `ctx` (`GameContext`) pour parler au backend.

## 1. Copier le template

```bash
cp -r src/games/clicker src/games/mon-jeu
```

`slug` : minuscules, chiffres et tirets (`mon-jeu`). Il sert d'URL (`/games/mon-jeu`) et de clé en base.

## 2. Déclarer le jeu

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

## 3. L'enregistrer en base

```bash
npx supabase migration new add_game_mon_jeu
```

```sql
insert into public.games (slug, title, description)
values ('mon-jeu', 'Mon Jeu', 'Une phrase de présentation.');
```

Sans cette ligne, l'envoi de score et la sauvegarde sont refusés (clé étrangère + RLS).

## 4. Utiliser le `GameContext`

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

## Mode invité (jeux `solo`)

Un jeu `solo` doit fonctionner sans compte. En invité, le `ctx` a la même API mais :

| Méthode          | Connecté                 | Invité                                  |
|------------------|--------------------------|-----------------------------------------|
| `submitScore`    | enregistré, renvoie true | ignoré, renvoie false                   |
| `getLeaderboard` | classement public        | classement public                       |
| `getMyBest`      | meilleur score           | null                                    |
| `save/loadSave`  | en base (Supabase)       | `localStorage` du navigateur            |

Pensez à gérer `ctx.player === null` (affichage du pseudo, etc.) et, en fin de partie, à inviter le
joueur à se connecter pour être classé (voir le clicker).

## Règles

- **Ne pas importer `@/lib/supabase` dans un jeu.** Tout passe par `ctx`. Si une fonctionnalité manque
  (multijoueur temps réel, succès, inventaire…), on l'ajoute au SDK pour tous les jeux.
- Le jeu ne touche pas au routing ni à l'auth : la page de jeu applique la règle du `mode` (solo / multijoueur).
- Code et assets du jeu restent dans `src/games/<slug>/` (ou `public/games/<slug>/`).
- Le jeu est chargé à la demande (`lazy`) : les dépendances lourdes (Phaser, Three.js…) n'alourdissent pas la plateforme.
- Besoin de tables propres au jeu ? Les préfixer par le slug (`mon_jeu_xxx`), activer la RLS, et
  passer en revue avec l'équipe plateforme.
- Avant de pousser : `npm run lint && npm run build`.
