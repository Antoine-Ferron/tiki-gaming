# Tests de Prismine

Les tests suivent l'[approche TDD](../../../../CONTRIBUTING.md#approche-tdd) : chaque règle du jeu est décrite
par un test. Ils tournent avec Vitest, comme le reste du front :

```bash
cd frontend
npm test                                   # tous les tests du front (relancés par la CI)
npx vitest run src/games/prismine          # seulement ceux de Prismine
npx vitest src/games/prismine              # mode surveillance pendant le développement
```

## Organisation

| Fichier                        | Type        | Ce qui est testé                                                   | Doublures            |
| ------------------------------ | ----------- | ------------------------------------------------------------------ | -------------------- |
| `engine.test.ts`               | unitaire    | Trajet des faisceaux, génération des étages, pose des pièces       | aucune (code pur)    |
| `expedition.test.ts`           | unitaire    | Huile, validation de la carte, score, lecture de la sauvegarde     | bouchon du hasard    |
| `labels.test.ts`               | unitaire    | Textes affichés au joueur (accords, formulations)                  | aucune               |
| `session.test.ts`              | unitaire    | Échanges avec la plateforme : sauvegarde, reprise, envoi du score  | bouchons, simulacres |
| `prismine.integration.test.ts` | intégration | Expéditions complètes, de l'ouverture du jeu au score classé       | faux `GameContext`   |
| `test-doubles.ts`              | outil       | Faux `GameContext` en mémoire et promesse contrôlable (`deferred`) | —                    |

- **Tests unitaires (TU)** : une seule unité à la fois, isolée de tout le reste. Les règles du jeu (`engine.ts`,
  `expedition.ts`) sont des fonctions pures : on les appelle directement, sans doublure.
- **Tests d'intégration (TI)** : les vrais modules travaillent ensemble (`engine` → `expedition` → `session`) et
  parlent à un faux `GameContext`. On vérifie ce que la plateforme reçoit réellement : sauvegardes successives,
  reprise après rechargement, score et métadonnées envoyés, différence joueur connecté / invité.

## Doublures de test

Le jeu ne parle à la plateforme que par le `GameContext` (`ctx`). Les fonctions de `session.ts` ne demandent que
la partie du `ctx` dont elles ont besoin (`Pick<GameContext, 'save'>`…) : un test peut donc leur passer une doublure
minimale à la place du vrai SDK, sans Supabase ni réseau.

| Doublure             | Rôle                                          | Exemple                                                                               |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Bouchon** (stub)   | Renvoie une réponse préparée, sans logique    | `loadSave: async () => null` (nouveau joueur) ; `() => 0` à la place de `Math.random` |
| **Simulacre** (mock) | Fonction espionne dont on vérifie les appels  | `submitScore = vi.fn()` puis `toHaveBeenCalledExactlyOnceWith(450, {...})`            |
| **Faux** (fake)      | Implémentation simplifiée mais qui fonctionne | `createFakeContext()` : sauvegarde en mémoire, passée en JSON comme en base           |

`createFakeContext({ player })` reproduit le comportement du SDK : avec `player: null` (invité), `submitScore`
renvoie `false` et rien n'est classé. Chacune de ses méthodes est aussi un simulacre `vi.fn()`.

`deferred()` crée une promesse qu'on résout à la main : elle fige une sauvegarde « en cours d'écriture » pour vérifier
qu'une ancienne sauvegarde n'écrase jamais une plus récente (`session.test.ts`).

## Reproductibilité

- Un étage est entièrement défini par sa profondeur et sa graine : les tests utilisent des graines fixes.
- Les tests de propriétés (`engine.test.ts`) rejouent 400 étages générés : réversibilité des trajets, nombre de
  pièces, pièces toutes atteignables par un faisceau.
- Le seul hasard des règles (le tir révélé après une erreur) est injecté en paramètre de `validate` : les tests le
  remplacent par un bouchon.

## Non couvert

- Le rendu React (`PrismineGame.tsx`, `Board.tsx`, `ProbeLog.tsx`) : le front n'a pas d'environnement DOM de test
  (jsdom / Testing Library). L'interface a été vérifiée dans un navigateur (partie complète, clavier, 360 px).
- Le vrai SDK (`sdk.ts`) et Supabase : ils appartiennent à la plateforme.
