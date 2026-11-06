# LemurTiki

Jeu solo de la plateforme Tiki Gaming (issue #19, slug `lemur`). Un maki grimpe un baobab de Madagascar en
rebondissant de branche en branche, pendant qu'une fossa le poursuit par en dessous et accélère sans cesse. Le joueur
ne dirige que la gauche et la droite et doit monter le plus haut possible en une seule vie. Genre : runner vertical,
dans l'esprit de Doodle Jump ou Panda Jump.

- Spécification complète (exigences EF / ENF, critères d'acceptation, paramètres) :
  [docs/games/lemur/specification.md](../../../../docs/games/lemur/specification.md)
- Traçabilité exigences ↔ tests : lignes `REQ-LEM-*` et `TC-LEM-*` de [specs/rtm-matrix.md](../../../../specs/rtm-matrix.md)

## Jouer

| Action            | Clavier                                         |
| ----------------- | ----------------------------------------------- |
| Diriger le maki   | Flèches, ou Q / D (A / D en QWERTY)             |
| Pause / reprendre | Échap ou P (pause aussi si l'onglet est masqué) |

- Le maki rebondit tout seul sur une branche touchée en descendant, et la traverse en montant.
- Les bords de l'écran sont reliés : sortir à gauche fait revenir à droite.
- La partie s'arrête si le maki tombe sous l'écran ou si la fossa l'attrape.
- **Score** = mètres entiers atteints + 10 par gousse de vanille, plafonné à 100 000 (`games.max_score`).
- En invité, on joue normalement mais le score n'est pas classé ; connecté, il part une fois au classement en fin de
  partie, et il est gardé sur l'appareil en cas de coupure réseau.

## Architecture

Hexagonale : la logique est du TypeScript pur, sans React, canvas ni réseau ; le reste ne fait que l'adapter.

```
lemur/
├── domain/        Règles pures : physique (game), branches, fossa, fin de partie (advance), score, début (start)
├── application/   finish : relie une partie terminée au GameContext du SDK (envoi du score, messages)
├── controls.ts    Adaptateur clavier : touche → commande du domaine
├── render.ts      Adaptateur canvas : dessine l'état, ne le modifie jamais
├── LemurGame.tsx  Adaptateur React : boucle d'images, écrans (menu, pause, fin)
├── features/      Scénarios Gherkin (.feature) et leurs étapes, branchées sur le domaine
└── testing/       Builder aGame() des parties de test
```

- **Ports** : le hasard est injecté (`Random = () => number`) et la plateforme passe par `GameContext` ; rien
  n'importe `@/lib/supabase`.
- **Déterminisme** : même tirage = même partie ; la boucle avance par pas fixes de 1/60 s quelle que soit la fréquence
  d'affichage, et React ne se re-rend que quand la hauteur ou le score changent.
- **Unités** : monde en pixels, axe y vers le haut, 10 px = 1 m ; l'écran fait 360 × 640 px.

## Tests

| Niveau                       | Où                                           | Ce qui est vérifié                                                                                   |
| ---------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| BDD (Gherkin, français)      | `features/*.feature`                         | Règles métier, de bout en bout dans le domaine ; valeurs limites en `Plan du scénario`               |
| Unitaire (valeurs limites)   | `domain/*.test.ts`, `controls.test.ts`       | Contact maki-branche à 1 px près, écart des branches, vitesse de la fossa, touches                   |
| Propriétés (fast-check)      | `domain/lemur.property.test.ts`              | Invariants sur des parties générées (le maki reste dans l'écran, le score reste entre 0 et 100 000…) |
| Application (doublures)      | `application/finish.test.ts`                 | Envoi du score une seule fois (Spy), pannes et session expirée (Stub)                                |
| Plateforme (Fake)            | `features/plateforme.feature`                | Vrai SDK avec `fakeDeps()` : joueur, invité, coupure réseau simulée                                  |
| Composant (Testing Library)  | `LemurGame.test.tsx`, `render.test.ts`       | Écrans, pause, fin, Rejouer, sur de faux minuteurs ; dessin sur un faux contexte 2D                  |
| E2E (Playwright + axe)       | `frontend/e2e/lemur.spec.ts`                 | Accueil → jeu → partie complète → Rejouer ; audit WCAG 2.1 AA pendant la partie                      |
| Intégration (Testcontainers) | `frontend/tests/integration/catalog.test.ts` | Ligne `lemur` en base alignée avec `index.ts` (catégorie, thème, score max)                          |

Doublures utilisées : Stub (tirage fixé, réponses de `submitScore`), Spy (`submitScore` appelé une fois), Fake
(`FakeScores`, faux contexte 2D). Aucun mock de module.

Mesures (5 novembre 2026, en local) : 249 tests lemur ; mutation Stryker à **100 %** sur `domain/`, `application/` et
`controls.ts` (seuil du projet : 75 %) ; 8 exigences et 41 cas de test dans la RTM.

### Lancer les tests

Depuis `frontend/` :

```bash
npx vitest run src/games/lemur
```

```bash
npx playwright test e2e/lemur.spec.ts
```

```bash
npx stryker run --mutate "src/games/lemur/domain/*.ts,src/games/lemur/application/*.ts,src/games/lemur/controls.ts,!src/games/lemur/**/*.test.ts"
```

## Pas encore fait

Tactile (EF-7.4), record affiché dans le menu, sauvegarde (EF-8.4), décor selon la hauteur, branches mobiles et
fragiles, mangue (V1).
