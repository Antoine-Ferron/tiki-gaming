# Dames — matrice de traçabilité des exigences

Cette matrice décrit le lot livré sur la base `659d4fb9` au 6 novembre 2026.
Les exigences métier viennent du [backlog US-01 à US-12](backlog.md), du
[contrat des rencontres](rencontres.md) et du [contrat API](api.md).
Elle relie les besoins à une sélection de tests de référence ; les suites
complètes restent décrites dans leurs fichiers et dans l'[index métier](tests-metier.md).

## Lecture des preuves

- **B06** : tests backend Dames rejoués le 6 novembre 2026 sur `659d4fb9` :
  394 cas, aucun échec, erreur ou ignoré. Cela inclut unitaires, Spring HTTP,
  Pact fournisseur et BDD ; cela n'inclut pas les `*IT`.
- **F06** : tests frontend Dames rejoués le 6 novembre 2026 sur la même base ;
  **18 tests réussis**, résultat détaillé dans le [bilan de qualité](qualite.md).
- **CI05** : [CI de la PR #116](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050),
  tête `f65034f09d4da9ac00cf36b30b6f0290f1f3ef7e`, 5 novembre 2026.
  Les jobs intégration et Playwright des trois navigateurs sont réussis.
  Ce résultat historique n'est pas une réexécution des IT ou E2E le 6 novembre.

Les statuts portent sur ces exécutions identifiées. Un cas de refus qui passe
est **PASSED** : il vérifie que le système rejette correctement la commande.
Une procédure de recette non jouée reste **À EXÉCUTER**, même si son test
automatisé associé est vert.

La table est propre à Dames ; elle n'est pas intégrée au vérificateur de la
RTM collective. Les liens et noms de tests sont contrôlés à la publication
de ce bilan, mais aucun nouveau contrôle CI n'est revendiqué.

## Exigences et cas automatisés

| Exigence    | Comportement attendu                                                                           | Cas nominal                                                                                                                                                                                                        | Cas de refus ou limite                                                                                                                                                                                    | Résultat / preuve   |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| REQ-DAME-01 | Damier 10 × 10, 20 pions par camp et cases jouables (US-01/02).                                | **TC-DAME-01N** · [InitialPlacementTest](../../backend/src/test/java/fr/tikigaming/games/dame/InitialPlacementTest.java) › `startsWithExactlyFortyMenTwentyOfEachColour`                                           | **TC-DAME-01L** · [BoardTest](../../backend/src/test/java/fr/tikigaming/games/dame/BoardTest.java) › `rejectsAPieceOnALightSquare`                                                                        | PASSED · B06        |
| REQ-DAME-02 | Un déplacement simple valide fait alterner les camps (US-03/04/05).                            | **TC-DAME-02N** · [SimpleMovementTest](../../backend/src/test/java/fr/tikigaming/games/dame/SimpleMovementTest.java) › `movesAManOneSquareForwardAndPreservesAllPieces`                                            | **TC-DAME-02L** · [TurnManagementTest](../../backend/src/test/java/fr/tikigaming/games/dame/TurnManagementTest.java) › `doesNotLetTheSamePlayerMoveTwice`                                                 | PASSED · B06        |
| REQ-DAME-03 | Une capture disponible interdit les déplacements ordinaires du camp (US-06/07).                | **TC-DAME-03N** · [MandatoryCaptureTest](../../backend/src/test/java/fr/tikigaming/games/dame/MandatoryCaptureTest.java) › `listsOnlyTheCaptureWhenAnotherPieceCouldMakeASimpleMove`                               | **TC-DAME-03L** · [MandatoryCaptureTest](../../backend/src/test/java/fr/tikigaming/games/dame/MandatoryCaptureTest.java) › `rejectsASimpleMoveByAnotherPieceWhenACaptureExistsElsewhere`                  | PASSED · B06        |
| REQ-DAME-04 | Une rafle doit être complète et prendre le maximum global (US-08).                             | **TC-DAME-04N** · [MultipleCaptureTest](../../backend/src/test/java/fr/tikigaming/games/dame/MultipleCaptureTest.java) › `acceptsTheGlobalMaximumAndRemovesExactlyThreeOpponents`                                  | **TC-DAME-04L** · [MultipleCaptureTest](../../backend/src/test/java/fr/tikigaming/games/dame/MultipleCaptureTest.java) › `rejectsTwoCapturesWhenAnotherPieceCanCaptureThree`                              | PASSED · B06        |
| REQ-DAME-05 | Une dame se déplace à distance sans traverser un allié (US-10).                                | **TC-DAME-05N** · [KingMovementTest](../../backend/src/test/java/fr/tikigaming/games/dame/KingMovementTest.java) › `movesAlongEachFreeDiagonalAtDifferentDistances`                                                | **TC-DAME-05L** · [KingMovementTest](../../backend/src/test/java/fr/tikigaming/games/dame/KingMovementTest.java) › `cannotLandOnOrPassThroughAnAlliedPiece`                                               | PASSED · B06        |
| REQ-DAME-06 | La promotion dépend de l'arrivée finale, sans pouvoir anticipé de dame (US-09).                | **TC-DAME-06N** · [PromotionTest](../../backend/src/test/java/fr/tikigaming/games/dame/PromotionTest.java) › `promotesWhiteOnlyAfterTheFinalJumpOfACompleteCapture`                                                | **TC-DAME-06L** · [PromotionTest](../../backend/src/test/java/fr/tikigaming/games/dame/PromotionTest.java) › `rejectsUsingFlyingKingPowersDuringTheCaptureThatReachesThePromotionRank`                    | PASSED · B06        |
| REQ-DAME-07 | La dernière capture peut donner la victoire ; l'état terminal est stable (US-11, hors nulles). | **TC-DAME-07N** · [GameEndTest](../../backend/src/test/java/fr/tikigaming/games/dame/GameEndTest.java) › `takingTheLastBlackPieceAwardsWhiteTheVictory`                                                            | **TC-DAME-07L** · [GameEndTest](../../backend/src/test/java/fr/tikigaming/games/dame/GameEndTest.java) › `aCommandAfterVictoryIsRejectedWithoutChangingTheTerminalState`                                  | PASSED · B06        |
| REQ-DAME-08 | Réinitialiser reconstruit une partie indépendante (US-12).                                     | **TC-DAME-08N** · [GameResetTest](../../backend/src/test/java/fr/tikigaming/games/dame/GameResetTest.java) › `resettingAfterWhiteWinsRestoresAnInProgressGame`                                                     | **TC-DAME-08L** · [GameResetTest](../../backend/src/test/java/fr/tikigaming/games/dame/GameResetTest.java) › `resettingDoesNotMutateAnOldBoardReference`                                                  | PASSED · B06        |
| REQ-DAME-09 | Les noms normalisés contiennent de 1 à 50 unités UTF-16.                                       | **TC-DAME-09N** · [MatchTest](../../backend/src/test/java/fr/tikigaming/games/dame/matches/MatchTest.java) › `acceptsNamesAtBothLengthBoundariesAfterTrimming`                                                     | **TC-DAME-09L** · [MatchServiceDoublesTest](../../backend/src/test/java/fr/tikigaming/games/dame/matches/MatchServiceDoublesTest.java) › `invalidNamesNeverReachTheRepository`                            | PASSED · B06        |
| REQ-DAME-10 | Une création est relue par le vrai dépôt ; la base refuse les noms invalides.                  | **TC-DAME-10N** · [SupabaseMatchRepositoryIT](../../backend/src/test/java/fr/tikigaming/games/dame/persistence/SupabaseMatchRepositoryIT.java) › `createsAndReadsThroughTheRealHttpAdapter`                        | **TC-DAME-10L** · [SupabaseMatchRepositoryIT](../../backend/src/test/java/fr/tikigaming/games/dame/persistence/SupabaseMatchRepositoryIT.java) › `databaseRejectsInvalidNamesEvenWhenJavaIsBypassed`      | PASSED · CI05       |
| REQ-DAME-11 | Le résultat vient du moteur et une seconde clôture ne l'écrase pas.                            | **TC-DAME-11N** · [SupabaseMatchRepositoryIT](../../backend/src/test/java/fr/tikigaming/games/dame/persistence/SupabaseMatchRepositoryIT.java) › `storesTheWinnerComputedByTheEngine`                              | **TC-DAME-11L** · [SupabaseMatchRepositoryIT](../../backend/src/test/java/fr/tikigaming/games/dame/persistence/SupabaseMatchRepositoryIT.java) › `onlyOneOfTwoConcurrentResultsIsAccepted`                | PASSED · CI05       |
| REQ-DAME-12 | Seule la session propriétaire accède à sa rencontre.                                           | **TC-DAME-12N** · [DameApiHttpTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApiHttpTest.java) › `readsAndPlaysOnlyTheMatchKeptByTheSession`                                                   | **TC-DAME-12L** · [DameApiHttpTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApiHttpTest.java) › `anotherSessionCannotReadOrMoveAKnownMatch`                                          | PASSED · B06        |
| REQ-DAME-13 | L'API valide les commandes et impose CSRF aux écritures.                                       | **TC-DAME-13N** · [DameApiHttpTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApiHttpTest.java) › `startsAGuestMatchWithItsLocationAndNormalizedNames`                                          | **TC-DAME-13L** · [DameApiHttpTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApiHttpTest.java) › `csrfIsRequiredForCreationAndMoves`                                                  | PASSED · B06        |
| REQ-DAME-14 | Une version périmée ne peut pas appliquer une seconde commande.                                | **TC-DAME-14N** · [DameApplicationServiceTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApplicationServiceTest.java) › `anOrdinaryMoveAdvancesTheServerStateButDoesNotWriteAnUnfinishedResult` | **TC-DAME-14L** · [DameApplicationServiceTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApplicationServiceTest.java) › `aStaleVersionCannotApplyASecondMove`                          | PASSED · B06        |
| REQ-DAME-15 | Une victoire n'est confirmée en session qu'après persistance cohérente.                        | **TC-DAME-15N** · [DameApplicationServiceTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApplicationServiceTest.java) › `theEngineDeterminesAndPersistsTheWinnerBeforeTheSessionIsCommitted`    | **TC-DAME-15L** · [DameApplicationServiceTest](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApplicationServiceTest.java) › `aFailedResultWriteKeepsTheLastMoveUncommittedAndCanBeRetried` | PASSED · B06        |
| REQ-DAME-16 | Reprendre après rechargement, gérer la perte de session sans création automatique.             | **TC-DAME-16N** · [DameGame.test.tsx](../../frontend/src/games/dame/DameGame.test.tsx) › `une relecture reprend la rencontre de cet onglet sans créer une nouvelle ligne`                                          | **TC-DAME-16L** · [DameGame.test.tsx](../../frontend/src/games/dame/DameGame.test.tsx) › `une rencontre absente de la session efface seulement son identifiant local`                                     | PASSED · F06        |
| REQ-DAME-17 | Permettre le parcours au clavier et vérifier l'accessibilité du formulaire/damier à 360 px.    | **TC-DAME-17N** · [DameGame.test.tsx](../../frontend/src/games/dame/DameGame.test.tsx) › `le clavier déplace le focus et permet de sélectionner puis annuler`                                                      | **TC-DAME-17L** · [dame.spec.ts](../../frontend/e2e/dame.spec.ts) › `Dames : formulaire et damier accessibles sur mobile, sans débordement horizontal`                                                    | PASSED · F06 / CI05 |

Les cas limites sont des représentants, pas un inventaire exhaustif. Par
exemple, les rafles incomplètes, captures répétées, deux camps et dates invalides
disposent d'autres tests dans les mêmes suites.
Les nulles, la sauvegarde durable du plateau et le multijoueur réseau sont
hors du lot : ils ne sont pas déclarés « couverts » par cette matrice.

## Preuves complémentaires et navigation inverse

| Source                                                                                                                                                                    | Exigences concernées          | Ce qu'elle apporte                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| [rencontres.feature](../../backend/src/test/resources/features/dame/rencontres.feature)                                                                                   | REQ-DAME-09, 11               | Exemples métier de noms, victoire et résultat immuable              |
| [prises-et-victoire.feature](../../backend/src/test/resources/features/dame/prises-et-victoire.feature)                                                                   | REQ-DAME-03, 04, 07           | Obligation, majorité et dernière capture                            |
| [DameApiPersistenceIT](../../backend/src/test/java/fr/tikigaming/games/dame/api/DameApiPersistenceIT.java)                                                                | REQ-DAME-10 à 14              | API Spring/CSRF avec dépôt et base réels                            |
| [Pact consommateur](../../frontend/tests/contract/dame.pact.test.ts) et [fournisseur](../../backend/src/test/java/fr/tikigaming/games/dame/api/DamePactProviderTest.java) | REQ-DAME-10, 12 à 14, 16      | Six interactions de contrat ; dépôt fake côté fournisseur           |
| [dame.spec.ts](../../frontend/e2e/dame.spec.ts)                                                                                                                           | REQ-DAME-09, 15 à 17          | Parcours visible, erreurs réseau, rechargement et axe ; API simulée |
| [Cahier de recette](recette.md)                                                                                                                                           | Exigences précisées par fiche | Six parcours vérifiés par l’agent ; acceptation humaine à confirmer |

## Gestion des écarts

Si une exécution future échoue, conserver la commande, le commit, les données
et le résultat observé ; ouvrir une anomalie avec attendu/obtenu, sévérité et
priorité, puis relier son numéro au cas concerné. Un statut FAILED ou BLOCKED
doit pointer vers cette anomalie. La clôture demande un re-test documenté,
conformément à [CONTRIBUTING](../../CONTRIBUTING.md).

Aucune nouvelle anomalie n'est inventée pour compléter la matrice.
La [PR #131](https://github.com/EAnathos/tiki-gaming/pull/131) reste une trace
réelle de correction de la disponibilité de PostgreSQL, attribuée au reviewer.

## Vérification complémentaire des parcours réels

La [campagne du 6 novembre à 13:33 CET](preuves/2026-11-06/README.md),
sur `ea9cf0c7`, exécute les six fiches du cahier dans Chromium avec les vrais
services. Les statuts de la table automatisée ci-dessus restent rattachés à
B06/F06/CI05 ; les nouvelles observations sont consignées dans les fiches UAT,
avec la mention **PASSED (agent)** et sans signature humaine implicite.
