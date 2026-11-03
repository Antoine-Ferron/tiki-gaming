# LemurTiki — plan de développement J2 → J4 (priorité aux tests)

> Contexte : formation « Tests et Qualité Logicielle » (RNCP 40166, blocs 4 et 5). Le projet se mène du
> lundi (J1) au jeudi (J4), et la soutenance individuelle a lieu le vendredi (J5).
> Aujourd'hui : **J2, mardi 3 novembre 2026**. Spécification : [specification.md](specification.md).
> Les modules J3 et J4 ne sont pas encore ouverts : ce plan suit leurs titres et sera ajusté à leur ouverture.

## Ce qui est noté, et ce que ça implique pour Lemur

| Critère du barème                   | Points | Ce que Lemur doit montrer                                                                                                                             |
| ----------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualité du code mergé en nom propre |      2 | Architecture hexagonale : le domaine `engine` est pur, et le canvas, le clavier et `ctx` sont des adaptateurs. Complexité cognitive ≤ 15, aucun `any` |
| Robustesse des suites de tests      |      3 | TDD rouge → vert → refactor, tests < 5 ms, Stubs et Fakes plutôt que des mocks ; Testcontainers ; mutation ≥ 75 % sur le domaine                      |
| Traçabilité Git, audit IA, CI       |      3 | Commits atomiques **à ton nom**, PR documentée et relue, CI verte et bloquante                                                                        |
| Soutenance : démo en direct         |      6 | Jouer une partie, puis lancer les tests en direct, y compris les frontières (BVA)                                                                     |
| Soutenance : défense des choix      |      6 | Justifier la pyramide (boîtes blanche, noire et grise), présenter les métriques réelles (mutants tués, couverture, axe)                               |

**Conséquence : la note se joue sur les tests et leur preuve, pas sur la richesse du jeu.** On vise un MVP jouable
mais solidement testé ; la V1 (bonus, branches spéciales, décor) n'arrive que s'il reste du temps.

## Stratégie de test (pyramide)

| Niveau            | Boîte   | Outil                                          | Ce qu'on y met pour Lemur                                                                                                            |     Part |
| ----------------- | ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------: |
| Unitaire (TDD)    | Blanche | Vitest                                         | Physique, collisions, génération, fossa, score : fonctions pures, `Random` injecté (Stub)                                            |    ~70 % |
| BDD (acceptation) | Noire   | vitest-cucumber, `.feature` en français        | Règles de la spec (EF-1 à EF-6, EF-8), Plans du scénario pour les frontières, branchés **sur le domaine et le SDK, jamais sur l'UI** | (inclus) |
| Composant         | Grise   | Testing Library (jsdom), `GameContext` en Fake | Écrans, pause, invité, messages d'erreur (EF-7, EF-8.3, EF-8.5)                                                                      |    ~15 % |
| Intégration       | Grise   | Testcontainers (Postgres réel)                 | Ligne `lemur` du catalogue, RLS sur `max_score` aux frontières 100 000 / 100 001                                                     |     ~5 % |
| E2E               | Noire   | Playwright + axe                               | Un seul parcours : accueil → Lemur → partie → fin, plus l'audit d'accessibilité                                                      |    ~10 % |
| Mutation          | Blanche | Stryker                                        | `src/games/lemur/engine.ts` ajouté à `mutate`, seuil bloquant 75 %                                                                   |        — |

Doublures, d'après J1 PM :

- **Stub** : `Random`, une suite de tirages fixée qui rend la génération déterministe.
- **Fake** : `GameContext`, via `createGameContext` et `fakeDeps()` (déjà dans le dépôt).
- **Spy** : `submitScore`, pour vérifier qu'il est appelé **une seule fois** par partie.
- Aucun mock de la logique interne.

## Discipline commune à tous les jours

- **Cycle TDD visible dans Git** : `test(lemur): …` (rouge), puis `feat(lemur): …` (vert), puis `refactor(lemur): …`.
  Cet historique est la preuve TDD demandée par la MSPR 4.1.
- **Imputabilité** : un audit IA analyse l'arbre Git pour isoler ce qui est mergé à ton nom.
  - Vérifie ton `user.name` et ton `user.email`.
  - Tu dois pouvoir expliquer chaque test en soutenance.
  - Branche : le barème cite `feat/nom-prenom/feature`, le dépôt utilise `game/lemur/…`. Vois avec ta squad laquelle prime.
- **Avant chaque push** : `npm run format && npm run lint && npm test && npm run build`.
- **Matrice de traçabilité (RTM)** : chaque test cite l'identifiant de l'exigence qu'il couvre (`EF-5.2`…).

## J2 — mardi (aujourd'hui) : BDD et cœur du domaine en TDD

Thèmes du cours : J2 AM « Spécification par l'exemple et BDD », J2 PM « Intégration avec Testcontainers et SonarQube ».

- [ ] **Trois Amigos (15 min)** : relire la spec avec ta squad, trancher ses questions ouvertes, valider les tableaux de frontières.
- [ ] Committer la spec (`docs(lemur): …`) et la reporter sur l'issue #19.
- [ ] Mise en place sans logique :
  - recopier le template, déclarer le jeu (`index.ts`, registre) ;
  - écrire la migration `add_game_lemur` ;
  - ajouter `src/games/lemur/**` au `mutate` de Stryker.
- [ ] **Boucle externe BDD** : `features/deplacement.feature` et ses étapes. Elles sont rouges.
- [ ] **Boucle interne TDD**, dans cet ordre, une règle par cycle :
  1. rebond en descendant, traversée en montant (EF-1.2, EF-1.3) ;
  2. direction et bords reliés (EF-1.4, EF-1.5), avec les frontières x = 0 et x = largeur ;
  3. caméra qui ne redescend jamais (EF-2) ;
  4. génération des branches et écart inférieur à un saut (EF-3.1, EF-3.2) ;
  5. fossa : Plan du scénario sur 99 m, 100 m et la vitesse maximale (EF-5.2) ;
  6. game over (EF-6.1 à EF-6.3) ;
  7. score : arrondi 123,9 m → 123, plafond à 100 000 (EF-6.4, EF-6.5).
- [ ] **Intégration (après-midi)** : test Testcontainers montrant qu'un score de 100 000 est accepté et 100 001 refusé pour `lemur`, par la vraie RLS. Docker requis.
- [ ] Fin de journée : la suite BDD du domaine est verte, la CI est verte, une PR draft est ouverte.

## J3 — mercredi : mutation, CI, puis l'interface minimale et l'E2E

Thèmes du cours : J3 AM « Contrats Pact, mutation testing, CI/CD », J3 PM « E2E Playwright, recette UAT, matrice RTM ».

- [ ] **Mutation** : `npm run test:mutation`, puis tuer les mutants survivants du domaine. Objectif ≥ 75 % (bloquant), viser 90 %.
      Un mutant équivalent se désactive en justifiant la ligne.
- [ ] **Adaptateurs minces**, ensuite seulement :
  - un adaptateur d'entrée (clavier et toucher → `Input`) ;
  - un rendu canvas en formes simples ;
  - une coquille React (menu, pause, fin).
- [ ] **Tests de composants** avec un `GameContext` Fake : écran de fin, mode invité, erreur réseau, sauvegarde invalide ignorée, pause.
- [ ] **Scénarios BDD de la plateforme** (EF-8) : score envoyé une seule fois (Spy), invité non classé, coupure réseau.
- [ ] **E2E** : un parcours Playwright avec l'horloge contrôlée (`page.clock`), plus l'audit axe.
- [ ] **Matrice RTM** : tableau EF → fichiers de test → statut, dans `docs/games/lemur/`.
- [ ] Contrats Pact : peu pertinents ici, car le jeu ne parle qu'au SDK de la plateforme. Justifie ce choix plutôt que d'en ajouter.

## J4 — jeudi : stabiliser, mesurer, merger

Thèmes du cours : J4 AM « SRE, k6, résilience », J4 PM « DAST, RGPD, accessibilité, mise en production ».

- [ ] **Gel fonctionnel à midi.** Si du temps reste le matin, la V1 vient dans cet ordre : vanille, puis branches fragiles, puis mobiles, toujours en TDD.
- [ ] **Résilience** : le scénario de coupure réseau (score mis en file d'attente) est la preuve côté jeu.
      Le test de charge k6 vise l'API des scores, pas un jeu côté client : ne le fais que si la squad l'outille.
- [ ] **Accessibilité et RGPD** :
  - l'audit axe est vert ;
  - tout se joue au clavier ;
  - les contrastes respectent la charte ;
  - aucune donnée personnelle hormis le pseudo de la plateforme.
- [ ] Flakiness : lancer la suite 20 fois de suite (`vitest --repeat`) ; zéro échec aléatoire toléré.
- [ ] **Relecture de la PR**, CI verte, merge dans `dev`, issue #19 fermée comme complétée.
- [ ] **Préparation de la soutenance** :
  - collecter les métriques : score de mutation, durée des suites, nombre de scénarios, couverture ;
  - écrire le script de démo : partie, puis tests BVA en direct, puis mutant tué en direct.

## Ce qu'on coupe en premier si on prend du retard

1. Le décor selon la hauteur (EF-7.8).
2. La mangue, puis les branches mobiles, puis les branches fragiles (EF-3.3 à EF-3.6, EF-4).
3. Le soin visuel du canvas : des rectangles suffisent.

On ne coupe **jamais** : les tests du domaine, la mutation ≥ 75 %, la CI verte, l'E2E du parcours vital et la traçabilité.
