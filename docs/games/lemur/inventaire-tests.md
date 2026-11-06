# LemurTiki — Inventaire des tests

Mesuré le 6 novembre 2026.

## Vue d'ensemble

LemurTiki compte **120 cas de test** : 105 unitaires, 12 d'intégration et 3 E2E. Chaque test est classé selon trois axes
indépendants.

- **Niveau** : ce que le test exécute (le domaine seul, plusieurs pièces assemblées, ou l'application dans un navigateur).
- **Technique** : comment le test est écrit (exemple BDD, valeurs limites, propriété, doublure).
- **Boîte** : d'où viennent ses cas. Noire = de la spécification, blanche = du code, grise = un peu des deux.

| Niveau      | Cas | Techniques                                                                                                                       | Boîte                 |
| ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Unitaire    | 105 | BDD sur le domaine (46), valeurs limites du domaine (25), contrôles clavier (18), propriétés (7), adaptateurs avec doublures (9) | Noire, blanche, grise |
| Intégration | 12  | Vrai SDK (3), composant React (8), Testcontainers (1)                                                                            | Grise                 |
| E2E         | 3   | Playwright + axe                                                                                                                 | Noire                 |

Un cas = un scénario Gherkin ou une ligne de tableau d'exemples, ou un test Vitest classique. Vitest en affiche 249,
parce qu'il compte chaque étape Gherkin comme un test.

## Unitaire — 105 cas

Tous s'exécutent sans navigateur ni réseau, en quelques millisecondes.

### Exemples BDD sur le domaine — 46 cas, boîte noire

Écrits en Gherkin français depuis la spécification ; les étapes appellent directement le domaine pur. Fichiers :
`frontend/src/games/lemur/features/*.feature` et leurs `*.steps.test.ts`.

| Fichier               | Scénario                                                 | Cas |
| --------------------- | -------------------------------------------------------- | --- |
| `debut.feature`       | Une partie commence au pied du baobab                    | 1   |
| `debut.feature`       | Le maki rebondit tout de suite sur sa première branche   | 1   |
| `deplacement.feature` | Le maki rebondit sur une branche touchée en descendant   | 1   |
| `deplacement.feature` | Le maki traverse une branche en montant                  | 1   |
| `deplacement.feature` | Le joueur dirige le maki, et les bords sont reliés       | 6   |
| `camera.feature`      | La caméra suit le maki qui dépasse le milieu de l'écran  | 4   |
| `camera.feature`      | La caméra ne redescend jamais                            | 1   |
| `branches.feature`    | Des branches attendent toujours au-dessus de l'écran     | 2   |
| `branches.feature`    | Les branches passées sous l'écran disparaissent          | 2   |
| `branches.feature`    | Une branche est toujours à portée de saut                | 3   |
| `fossa.feature`       | La fossa accélère avec la hauteur, jusqu'à un maximum    | 4   |
| `fossa.feature`       | La fossa ne reste jamais à plus de 40 m sous l'écran     | 3   |
| `fin.feature`         | Le maki tombe sous l'écran                               | 3   |
| `fin.feature`         | La fossa rattrape le maki                                | 3   |
| `fin.feature`         | Après la fin, plus rien ne bouge                         | 1   |
| `score.feature`       | Le score compte la hauteur maximale et la vanille        | 7   |
| `score.feature`       | La hauteur maximale suit le maki sans jamais redescendre | 3   |

### Valeurs limites du domaine — 25 cas, boîte blanche

Écrits en regardant le code : chaque cas encadre une borne ou un palier.

| Fichier                   | Ce qui est encadré                                                                                                                                                 | Cas |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| `domain/game.test.ts`     | Contact maki-branche au pixel près : arêtes qui se touchent (pas de rebond) contre 1 px de recouvrement (rebond), à gauche, à droite et à cheval sur le bord relié | 8   |
| `domain/fossa.test.ts`    | Vitesse de la fossa : 99,9 / 100 m, 199,9 / 200 m, 1 299,9 / 1 300 m, plafond à 1 400 et 10 000 m                                                                  | 9   |
| `domain/branches.test.ts` | Écart entre deux branches selon la hauteur (0, 1 000, 2 000, 3 000 m) et le tirage minimal ou maximal                                                              | 8   |

### Contrôles clavier — 18 cas, boîte noire

`controls.test.ts`, tiré de l'exigence EF-7.3 : chaque touche donne la bonne commande.

- Gauche : ArrowLeft, q, Q, a. Droite : ArrowRight, d, D. Pause : Escape, p, P.
- Touches ignorées : ArrowUp, z, espace.
- Touches tenues ensemble : aucune, une à gauche, une à droite, les deux directions, une pause avec une touche inconnue.

### Propriétés fast-check — 7 cas, boîte noire

`domain/lemur.property.test.ts` : chaque propriété vérifie un invariant de la spécification sur 100 parties générées.

1. Le maki reste toujours dans la largeur de l'écran, quelle que soit la direction (EF-1.5).
2. La caméra et la hauteur maximale ne redescendent jamais (EF-2, EF-6.4).
3. Une partie terminée ne change plus, quoi que fasse le joueur (EF-6.3).
4. Une partie en cours avance toujours : la gravité ou un rebond change la vitesse du maki (EF-1). Seule exception en
   boîte blanche : elle a été écrite pour tuer le mutant `if (true)`.
5. Les branches restent à portée de saut et dans la largeur de l'écran, pour tout tirage (EF-3.2).
6. La fossa ne ralentit jamais en montant, et reste entre 4 et 20 m/s (EF-5.2).
7. Le score est un entier entre 0 et 100 000, qui ne baisse pas quand on monte plus haut (EF-6.4, EF-6.5).

### Adaptateurs avec doublures — 9 cas, boîte grise

| Fichier                      | Test                                                                                       | Doublure           |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| `application/finish.test.ts` | Envoie le score une seule fois, avec la hauteur, la vanille, la cause et la durée (EF-8.1) | Spy                |
| `application/finish.test.ts` | Invite un invité à se connecter quand le score ne part pas au classement (EF-8.3)          | Stub               |
| `application/finish.test.ts` | Score mis en attente : message au joueur, sans rejeter (EF-8.5)                            | Stub               |
| `application/finish.test.ts` | Session expirée : message au joueur, sans rejeter (EF-8.5)                                 | Stub               |
| `application/finish.test.ts` | Erreur inattendue : message au joueur, sans rejeter (EF-8.5)                               | Stub               |
| `render.test.ts`             | Peint le ciel sur tout l'écran avant le reste                                              | Fake (contexte 2D) |
| `render.test.ts`             | Place une branche selon la caméra (axe y du monde vers le haut, de l'écran vers le bas)    | Fake (contexte 2D) |
| `render.test.ts`             | Dessine le maki centré sur sa position, les pieds sur sa hauteur                           | Fake (contexte 2D) |
| `render.test.ts`             | Montre la fossa quand elle entre dans l'écran, pas quand elle est dessous                  | Fake (contexte 2D) |

## Intégration — 12 cas, boîte grise

Ces tests assemblent plusieurs vraies pièces : le SDK de la plateforme, React avec le domaine, ou une vraie base de données.

| Fichier                             | Test                                                                    | Ce qui est assemblé                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `features/plateforme.feature`       | Le score d'une partie terminée est envoyé une fois                      | Vrai SDK + `fakeDeps()`                                              |
| `features/plateforme.feature`       | Un invité joue sans être classé                                         | Vrai SDK + `fakeDeps()`                                              |
| `features/plateforme.feature`       | Une coupure réseau n'empêche pas de rejouer                             | Vrai SDK + `FakeScores` avec panne simulée                           |
| `LemurGame.test.tsx`                | Présente le jeu, ses commandes et un bouton Jouer (EF-7.1)              | React + domaine, jsdom, faux minuteurs                               |
| `LemurGame.test.tsx`                | Jouer lance une partie à 0 m, le maki grimpe tout seul (EF-7.2)         | idem                                                                 |
| `LemurGame.test.tsx`                | Échap met en pause et fige, P reprend (EF-7.3, EF-7.5)                  | idem                                                                 |
| `LemurGame.test.tsx`                | Le bouton Reprendre relance une partie en pause (EF-7.5)                | idem                                                                 |
| `LemurGame.test.tsx`                | Pause automatique quand l'onglet est masqué (EF-7.6)                    | idem                                                                 |
| `LemurGame.test.tsx`                | Écran de fin : cause, score, invitation à se connecter (EF-7.7, EF-8.3) | idem                                                                 |
| `LemurGame.test.tsx`                | Rejouer relance une partie à 0 m en un clic (EF-7.7)                    | idem                                                                 |
| `LemurGame.test.tsx`                | Envoie une seule fois le score d'un joueur connecté (EF-8.1)            | idem                                                                 |
| `tests/integration/catalog.test.ts` | `lemur` existe en base avec la même définition que `index.ts`           | Vraie base Postgres (Testcontainers), test partagé par tous les jeux |

Les scénarios de `plateforme.feature` sont écrits en BDD, donc en boîte noire par leur origine ; ils sont rangés ici parce
qu'ils exécutent le vrai SDK.

## E2E — 3 cas, boîte noire

`frontend/e2e/lemur.spec.ts`, avec Playwright. En CI, chaque cas tourne sur Chromium, Firefox et WebKit.

| Test                                                                                   | Ce qu'il prouve                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| De l'accueil au jeu : un invité ouvre LemurTiki depuis le catalogue                    | Le jeu est bien branché dans la plateforme                       |
| Une partie complète : le maki rebondit, la fossa l'attrape, puis Rejouer relance à 0 m | Le parcours entier, temps piloté par `page.clock` et hasard fixé |
| Aucune violation d'accessibilité WCAG 2.1 AA sérieuse ou critique sur la page du jeu   | Audit axe pendant la partie                                      |

## Doublures et mutation

Aucun `vi.mock` de module : les doublures sont passées en paramètre (le hasard, le `GameContext`), ce que permet
l'architecture hexagonale.

| Doublure   | Rôle                                 | Où                                                                                                                                                    |
| ---------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stub       | Impose une réponse                   | Tirage fixé (`CLIMBS` = 0,5, `STAYS` = 0) dans `LemurGame.test.tsx` ; réponses de `submitScore` dans `finish.test.ts` ; `Math.random` remplacé en E2E |
| Spy        | Enregistre les appels                | `submitScore` appelé une seule fois avec ses métadonnées ; `vi.spyOn(logger, 'error')`, qui remplace une méthode le temps du test, pas le module      |
| Fake       | Implémentation simplifiée qui marche | `fakeDeps()`, `FakeScores` (avec `failNext` pour la panne), `MemoryStorage` ; faux contexte 2D de `render.test.ts`                                    |
| Faux temps | Rend le temps déterministe           | `vi.useFakeTimers` pour le composant ; `page.clock` en E2E                                                                                            |

**Mutation (Stryker)** : 100 % sur `domain/`, `application/` et `controls.ts`, soit 166 mutants tués et 4 en timeout,
pour un seuil projet de 75 %. Le seul mutant qui avait survécu (`if (state.over)` → `if (true)`) a été tué par la
propriété 4.

## Relancer et recompter

Depuis `frontend/` :

```bash
npx vitest run src/games/lemur
npx playwright test e2e/lemur.spec.ts
npx stryker run --mutate "src/games/lemur/domain/*.ts,src/games/lemur/application/*.ts,src/games/lemur/controls.ts,!src/games/lemur/**/*.test.ts"
```

Les comptes de ce document sont des cas : un test Vitest classique, un scénario Gherkin, ou une ligne de son tableau
d'exemples. Vitest affiche 249, parce qu'il compte chaque étape Gherkin (Soit, Quand, Alors) comme un test. La
traçabilité exigence → test est dans `specs/rtm-matrix.md` (REQ-LEM-01 à 08, TC-LEM-01 à 41).
