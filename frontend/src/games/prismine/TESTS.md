# Tests de Prismine

Prismine est arbitré par le serveur Java : la carte cachée, les règles et le score vivent dans
`backend/src/main/java/fr/tikigaming/games/prismine/`. Le front React envoie les tirs et la carte du joueur, et
ne reçoit la vraie carte d'un étage qu'une fois celui-ci terminé.

**48 tests : 15 unitaires, 13 d'intégration (dont 7 sur un vrai Postgres), 15 scénarios BDD et 5 parcours E2E.** Les
unitaires suivent l'[approche TDD](../../../../CONTRIBUTING.md#approche-tdd) ; les scénarios BDD et E2E ont été écrits
après le code, pour figer son comportement.

```bash
# Backend, dans backend/ (JUnit 5 + AssertJ + Mockito)
mvn test -Dtest='fr.tikigaming.games.prismine.*Test'

# Front, dans frontend/ (Vitest)
npx vitest run src/games/prismine

# Intégration sur Postgres, dans frontend/ (Testcontainers, Docker requis)
npm run test:integration -- prismine-runs scores

# Parcours E2E, dans frontend/ (Playwright + axe : Chromium, Firefox, WebKit)
npx playwright test e2e/prismine.spec.ts
```

- **TU (test unitaire)** : une seule unité, isolée du reste par des doublures ou parce qu'elle est pure.
- **TI (test d'intégration)** : plusieurs vrais modules ensemble (HTTP, JSON, session, sauvegarde), avec un faux
  pour ce qui est externe (Supabase, serveur).

## Backend : `backend/src/test/java/fr/tikigaming/games/prismine/`

| #   | Type | Fichier                  | Test                                                           | Ce qu'il vérifie                                                                                                                                                                       |
| --- | ---- | ------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TU   | `EngineTest`             | `prismTurnsTheBeamOnItsHypotenuseAndSendsItBackOnItsFlatSides` | Un prisme dévie le faisceau d'un quart de tour sur sa face en biais, le renvoie d'où il vient sur ses faces plates                                                                     |
| 2   | TU   | `EngineTest`             | `beamStartsWhiteMixesPrismColorsAndIsAbsorbedByObsidian`       | Faisceau blanc au départ, mélange additif des couleurs, l'obsidienne absorbe, la couleur compte dans le résultat                                                                       |
| 3   | TU   | `FloorsTest`             | `generatesDeterministicSolvableFloorsWithReversibleBeams`      | Sur 400 étages : même graine = même étage, bonnes pièces et couleurs, toutes atteignables, trajets réversibles                                                                         |
| 4   | TU   | `ExpeditionTest`         | `probeCostsOilAndIsRefusedOnAKnownEntryOrWithAnEmptyLamp`      | Un tir coûte de l'huile ; refusé sur un bord déjà exploré ou lampe vide                                                                                                                |
| 5   | TU   | `ExpeditionTest`         | `validationClearsChargesContradictsOrPutsTheLampOut`           | Les 4 verdicts : étage réussi (points, huile), carte contredite (mauvaise couleur), carte fausse, lampe éteinte                                                                        |
| 6   | TU   | `PrismineServiceTest`    | `stubbedSeedsAndInMemoryRegistryKeepOneSafeLiveRunPerPlayer`   | **Atelier 1-2** : bouchon `StubSeedSource`, faux `InMemoryRunRepository` ; écriture périmée refusée (409), une seule expédition par compte ou session, invité abandonné à la connexion |
| 7   | TU   | `PrismineServiceTest`    | `recordsTheScoreWithItsDurationForAPlayerButNotForAGuest`      | **Atelier 2** : faux `InMemoryScoreRegistry` ; score + durée classés pour un joueur, rien pour un invité ; après une panne, expédition figée et score classé une seule fois            |
| 8   | TU   | `PrismineServiceTest`    | `auditsAnExpeditionOnlyOnceWhenFloorsAreClearedTooFast`        | **Atelier 3** : simulacre Mockito `AuditNotifier` appelé une seule fois, jamais à un rythme humain                                                                                     |
| 9   | TU   | `PrismineServiceTest`    | `clockDrivesTheAuditThresholdAndTheRunPurgeWithoutSleeping`    | **Atelier 4** : horloge `MutableClock` ; seuil d'audit à 5 s et purge à 24 h, testés à la milliseconde, sans `sleep`                                                                   |
| 10  | TI   | `PrismineControllerTest` | `playsAFullExpeditionAndRecordsTheScore`                       | Partie complète en HTTP (MockMvc) : création sans fuite de la carte, tir, refus 409, étage réussi, fin, puis 404                                                                       |
| 11  | TI   | `PrismineControllerTest` | `refusesAnUnreadableMapAnotherPlayersRunAndTooManyStarts`      | Carte illisible → 400 ; expédition invisible pour un autre joueur (404) ; trop d'expéditions par adresse → 429                                                                         |
| 12  | TI   | `SupabaseAdaptersTest`   | `storesRunsAndScoresInSupabaseAndReportsItsFailures`           | Requêtes PostgREST (clé service_role) : écriture versionnée, purge ; score inséré une seule fois ; panne → 502                                                                         |

Doublures dans `TestDoubles.java` : `StubSeedSource`, `InMemoryRunRepository`, `InMemoryScoreRegistry`,
`MutableClock` ; l'audit est un `mock(AuditNotifier.class)` créé dans le test.

## Front : `frontend/src/games/prismine/`

| #   | Type | Fichier                        | Test                            | Ce qu'il vérifie                                                                                           |
| --- | ---- | ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 13  | TU   | `engine.test.ts`               | trace                           | Le tracé de la carte du joueur suit les mêmes règles que le serveur, couleur après chaque point du trajet  |
| 14  | TU   | `engine.test.ts`               | nextPiece                       | Clic sur une case : prisme suivant dans la couleur choisie, obsidienne si l'étage en cache, repeint        |
| 15  | TU   | `expedition.test.ts`           | sauvegarde                      | Lecture de la sauvegarde (valide, illisible, ancienne version), carte reprise, statistiques de fin         |
| 16  | TU   | `api.test.ts`                  | createPrismineApi               | Chaque action part vers le bon endpoint Java avec le bon corps (transport simulé)                          |
| 17  | TU   | `labels.test.ts`               | textes                          | Noms des couleurs, description d'un tir, solution lue aux lecteurs d'écran                                 |
| 18  | TI   | `prismine.integration.test.ts` | expédition d'un joueur connecté | Sauvegarde → rechargement → reprise auprès du serveur → fin ; aucun score envoyé par le navigateur         |
| 19  | TI   | `prismine.integration.test.ts` | reprise impossible              | Expédition oubliée (404) ou sauvegarde ancienne : on repart de zéro sans perdre les stats ; panne remontée |
| 20  | TI   | `PrismineGame.test.tsx`        | écran de Prismine               | Le vrai composant (jsdom) joue une expédition : tir, pose souris et clavier, 3 verdicts, fin classée       |

Doublures dans `test-doubles.ts` : faux `GameContext` en mémoire (`createFakeContext`), bouchon du serveur
(`stubApi`, qui échoue sur tout appel non préparé) et `runView` pour construire une réponse du serveur.

## Intégration sur Postgres : `frontend/tests/integration/`

Migrations rejouées sur un conteneur éphémère : un droit SQL ou un index ne se prouve pas avec une doublure.

| Fichier                 | Tests | Ce qu'ils vérifient                                                                                                      |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| `prismine-runs.test.ts` | 6     | Ni joueur ni visiteur n'accède à `prismine_runs` ; expédition d'invité ; `updated_at` rafraîchi ; suppression en cascade |
| `scores.test.ts`        | 1     | Un joueur ne peut rien insérer ; le backend classe une seule fois chaque expédition (doublon `23505`)                    |

## BDD : `backend/src/test/resources/features/prismine/expedition.feature`

15 scénarios Gherkin (dont 3 plans aux valeurs limites) reliés au domaine pur par `ExpeditionSteps`, sans navigateur ni
base. `PrismineBddTest` les lance dans `mvn verify` et écrit la documentation vivante dans
`backend/target/cucumber-prismine.html`.

## E2E : `frontend/e2e/prismine.spec.ts`

5 parcours dans un vrai navigateur, sur les 3 moteurs : expédition complète d'un invité, verdicts de carte jusqu'à la
lampe éteinte, reprise après rechargement, pannes et refus du serveur, audit WCAG 2.1 AA de l'écran de jeu. Comme les
autres E2E du dépôt, le serveur arbitre et Supabase sont simulés par interception réseau.

## Mutation : Pitest sur le domaine Java

**82,1 % de mutants tués (206 sur 251, seuil de la CI : 75 %)** sur `Engine`, `Expedition`, `Floors` et
`PrismineScoreValidator`.

```bash
# Dans backend/ : rapport HTML dans target/pit-reports/index.html
mvn -B -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage
```

## Non couvert

- `Board.tsx` et `ProbeLog.tsx` n'ont pas de test dédié : ils sont couverts par le test de l'écran (#20).
- La reprise d'une expédition et l'écran d'erreur de chargement ne passent pas par le test de l'écran.
- `createSaver` (ordre des sauvegardes concurrentes) n'a plus de test dédié : seul son cas simple passe par les TI.
- Le vrai Supabase : les adaptateurs sont testés contre un serveur PostgREST simulé.
- Le navigateur relié au vrai serveur Java : les E2E simulent le serveur et les TI du backend n'ont pas de navigateur.
- La mutation côté front : Stryker ne porte pas sur le code de Prismine, seul le domaine Java passe par Pitest.
- 45 mutants non tués sur 251 (voir ci-dessous), dont 26 dans `Floors`.
