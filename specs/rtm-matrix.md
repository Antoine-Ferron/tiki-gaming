# Matrice de traçabilité des exigences (RTM)

Relie chaque exigence du lobby et du SDK des jeux aux tests qui la vérifient, et chaque échec à son anomalie. Elle se
lit dans les deux sens :

- **aval** (exigence → tests) : chaque exigence a au moins un cas **nominal** et un cas **d'erreur** ; une exigence
  sans test est une zone non vérifiée ;
- **amont** (test → exigence) : chaque cas de test se rattache à une exigence ; un test orphelin est obsolète ou
  superflu.

La chaîne est vérifiée à chaque run de CI par `npm run rtm:check` (job `Traçabilité (RTM)`, `frontend/scripts/rtm.mjs`) : exigence
sans cas nominal ou d'erreur, test rattaché à une exigence inconnue, preuve introuvable (fichier absent, titre de test
absent du fichier), cas `FAILED` ou `BLOCKED` sans anomalie, anomalie mal qualifiée ou close sans correctif.

**Statut** : `PASSED`, `FAILED` ou `BLOCKED`, celui de la dernière exécution en CI. Les tests automatisés tournent
tous en CI : un `PASSED` ici est rouge en CI dès que le test casse. **Preuve** : `` `fichier` › titre `` (titre
du test Vitest ou Playwright, scénario Gherkin, méthode JUnit). La recette manuelle (UAT) est dans
[cahier-de-recette.md](cahier-de-recette.md), et le cycle de vie des anomalies dans
[CONTRIBUTING.md](../CONTRIBUTING.md#anomalies).

## Exigences

| Exigence | Besoin | Source |
|----------|--------|--------|
| REQ-SCORE-01 | Un score n'est accepté que s'il est un entier entre 0 et le maximum déclaré par le jeu | Règles du classement (docs/architecture.md) |
| REQ-SCORE-02 | Seul le backend enregistre un score, pour le compte du joueur de la session ; le navigateur ne peut pas écrire de score | Anti-triche (PR scores serveur) |
| REQ-SCORE-03 | Un score envoyé pendant une coupure réseau ou une panne n'est pas perdu | Expérience joueur |
| REQ-RANK-01 | Le classement garde le meilleur score de chaque joueur ; les ex æquo partagent le même rang (1, 1, 3) | Règles du classement |
| REQ-AUTH-01 | Un visiteur s'inscrit par email et mot de passe avec un pseudo valide, et chaque erreur de saisie est expliquée | Comptes joueurs |
| REQ-AUTH-02 | Un visiteur peut s'inscrire ou se connecter avec Google, sans mot de passe | Comptes joueurs |
| REQ-AUTH-03 | Les pages réservées aux comptes renvoient un visiteur vers la connexion | Comptes joueurs |
| REQ-DATA-01 | Un joueur ne lit, n'écrit et n'efface que ses propres sauvegardes | RGPD, confidentialité (RLS) |
| REQ-GDPR-01 | Un joueur peut supprimer définitivement son compte et toutes ses données (droit à l'effacement) | RGPD, article 17 |
| REQ-ERR-01 | Une erreur réseau ou serveur s'affiche en message lisible, sans casser le lobby ni le jeu | Robustesse |
| REQ-A11Y-01 | Les pages du lobby respectent les WCAG 2.1 niveau AA (RGAA 4.1.2) | Accessibilité |
| REQ-PERF-01 | Le classement, l'envoi de score et la session répondent en P95 < 300 ms et P99 < 500 ms, avec moins de 1 % d'erreurs | SLO (docs/slo.md) |
| REQ-RES-01 | Une panne de Supabase est abandonnée au timeout puis coupée par un disjoncteur, et le service revient seul | SLO, résilience (docs/slo.md) |
| REQ-SEC-01 | Les requêtes qui modifient des données exigent le jeton CSRF ; le front envoie les en-têtes de sécurité (CSP…) | OWASP |
| REQ-API-01 | Le backend respecte le contrat d'API attendu par le front (forme des requêtes et réponses) | Intégration front/back |
| REQ-RH-01 | Rush Hour : un véhicule ne glisse que dans son sens, sans traverser les bords ni les autres véhicules | Règles R4, R5 (docs/games/rush-hour/regles.md) |
| REQ-RH-02 | Rush Hour : un coup = un glissement d'un véhicule, quelle que soit la distance ; les glissements successifs du même véhicule forment un seul coup | Règle R6 |
| REQ-RH-03 | Rush Hour : le score d'un niveau suit le barème (coups en trop, indices), jamais négatif, et refuse une partie impossible | Score § 7 |
| REQ-RH-04 | Rush Hour : le serveur rejoue les coups d'un niveau, calcule lui-même le score et refuse une partie truquée | Anti-triche S6 |
| REQ-RH-05 | Rush Hour : seul le niveau 1 est ouvert au départ ; terminer un niveau ouvre le suivant ; un record ne baisse jamais | Progression N3, N5 |
| REQ-RH-06 | Rush Hour : un plateau généré est résoluble, de la difficulté demandée, et ne compte pas au classement | Génération G2, G3, S4 |
| REQ-RH-07 | Rush Hour : un indice donne le prochain coup de la solution la plus courte et coûte des points | Indices P5 |
| REQ-RH-08 | Rush Hour : on joue à la souris (glisser-déposer calé sur une case) et au clavier (flèches dans le sens du véhicule) | Contrôles C1, C2 |
| REQ-RH-09 | Rush Hour : le jeu et le serveur appliquent les mêmes niveaux, les mêmes règles et le même barème | Contrat partagé (shared/games/rush-hour/contrat.json) |

## Cas de test

| Cas | Exigence | Nature | Niveau | Preuve | Statut | Anomalie |
|-----|----------|--------|--------|--------|--------|----------|
| TC-SCORE-01 | REQ-SCORE-01 | nominal | unitaire (BVA) | `frontend/src/games/domain/score.test.ts` › accepte %d | PASSED | — |
| TC-SCORE-02 | REQ-SCORE-01 | erreur | unitaire (BVA) | `frontend/src/games/domain/score.test.ts` › refuse -1, juste sous la frontière basse | PASSED | — |
| TC-SCORE-03 | REQ-SCORE-01 | nominal | BDD | `frontend/src/games/features/scores.feature` › Un score est accepté seulement entre 0 et le maximum du jeu | PASSED | — |
| TC-SCORE-04 | REQ-SCORE-01 | erreur | propriété (fast-check) | `frontend/src/games/domain/score.property.test.ts` › refuse tout entier au-dessus du maximum, en citant ce maximum | PASSED | — |
| TC-SCORE-05 | REQ-SCORE-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/scores.test.ts` › refuse 301 (> max_score), même pour le backend | PASSED | — |
| TC-SCORE-06 | REQ-SCORE-01 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/scores/ScoreControllerTest.java` › refusesANegativeScore | PASSED | — |
| TC-SCORE-07 | REQ-SCORE-02 | nominal | intégration (Testcontainers) | `frontend/tests/integration/scores.test.ts` › le backend enregistre le score d’un joueur, rattaché à son compte | PASSED | — |
| TC-SCORE-08 | REQ-SCORE-02 | erreur | intégration (Testcontainers) | `frontend/tests/integration/scores.test.ts` › un joueur connecté ne peut pas écrire de score depuis le navigateur, même le sien | PASSED | — |
| TC-SCORE-09 | REQ-SCORE-02 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/scores/ScoreControllerTest.java` › aGuestCannotRecordAScore | PASSED | — |
| TC-SCORE-10 | REQ-SCORE-03 | erreur | BDD | `frontend/src/games/features/scores.feature` › Un score envoyé pendant une coupure réseau n'est pas perdu | PASSED | — |
| TC-SCORE-11 | REQ-SCORE-03 | nominal | unitaire | `frontend/src/games/scoreQueue.test.ts` › vide la file quand l’envoi réussit et libère la clé | PASSED | — |
| TC-SCORE-12 | REQ-SCORE-03 | erreur | unitaire | `frontend/src/games/scoreQueue.test.ts` › survit au rechargement de la page (relu depuis le stockage) | PASSED | — |
| TC-RANK-01 | REQ-RANK-01 | nominal | BDD | `frontend/src/games/features/classement.feature` › Des ex æquo partagent le même rang et le rang suivant est sauté | PASSED | — |
| TC-RANK-02 | REQ-RANK-01 | nominal | propriété (fast-check) | `frontend/src/games/domain/leaderboard.property.test.ts` › le rang d’un joueur vaut 1 + le nombre de joueurs qui ont strictement mieux (1, 1, 3) | PASSED | — |
| TC-RANK-03 | REQ-RANK-01 | nominal | intégration (Testcontainers) | `frontend/tests/integration/scores.test.ts` › le classement garde le meilleur score de chaque joueur et compte ses parties, lisible sans compte | PASSED | — |
| TC-RANK-04 | REQ-RANK-01 | erreur | composant | `frontend/src/components/Leaderboard.test.tsx` › affiche un message quand personne n’a encore joué | PASSED | — |
| TC-AUTH-01 | REQ-AUTH-01 | nominal | composant | `frontend/src/pages/SignupPage.test.tsx` › sans confirmation, connecte le joueur et l’envoie à l’accueil | PASSED | — |
| TC-AUTH-02 | REQ-AUTH-01 | erreur | composant | `frontend/src/pages/SignupPage.test.tsx` › vérifie chaque champ avant d’appeler le backend | PASSED | — |
| TC-AUTH-03 | REQ-AUTH-01 | erreur | propriété (fast-check) | `frontend/src/lib/validation.property.test.ts` › un pseudo qui contient un caractère interdit est refusé, et le message nomme ce caractère | PASSED | BUG-01 |
| TC-AUTH-04 | REQ-AUTH-01 | erreur | unitaire (non-régression) | `frontend/src/lib/validation.test.ts` › cite un accent saisi en deux points de code (A + accent combinant) comme une seule lettre | PASSED | BUG-01 |
| TC-AUTH-05 | REQ-AUTH-02 | nominal | composant | `frontend/src/pages/SignupPage.test.tsx` › propose l’inscription avec Google, qui ramène à l’accueil sans demander de mot de passe | PASSED | — |
| TC-AUTH-06 | REQ-AUTH-02 | nominal | E2E (3 navigateurs) | `frontend/e2e/compte.spec.ts` › l’inscription propose Google et part vers le backend en revenant à l’accueil | PASSED | — |
| TC-AUTH-07 | REQ-AUTH-02 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/auth/GoogleLoginSuccessHandlerTest.java` › verifiedEmailIsLinkedThenThePlayerReturnsToTheRequestedPage | PASSED | — |
| TC-AUTH-08 | REQ-AUTH-02 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/auth/GoogleLoginSuccessHandlerTest.java` › unverifiedEmailIsRefusedWithoutTouchingSupabase | PASSED | — |
| TC-AUTH-09 | REQ-AUTH-02 | erreur | composant | `frontend/src/pages/LoginPage.test.tsx` › explique l’échec de la connexion Google (?error=%s) | PASSED | — |
| TC-AUTH-10 | REQ-AUTH-03 | nominal | composant | `frontend/src/auth/ProtectedRoute.test.tsx` › affiche la page à un joueur connecté | PASSED | — |
| TC-AUTH-11 | REQ-AUTH-03 | erreur | E2E (3 navigateurs) | `frontend/e2e/lobby.spec.ts` › une page réservée aux comptes renvoie vers la connexion | PASSED | — |
| TC-DATA-01 | REQ-DATA-01 | nominal | intégration (Testcontainers) | `frontend/tests/integration/saves-profiles.test.ts` › un joueur écrit, relit et écrase sa sauvegarde | PASSED | — |
| TC-DATA-02 | REQ-DATA-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/saves-profiles.test.ts` › un joueur ne peut ni écrire, ni modifier, ni effacer la sauvegarde d’un autre | PASSED | — |
| TC-DATA-03 | REQ-DATA-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/saves-profiles.test.ts` › un visiteur non connecté n’a aucun accès aux sauvegardes | PASSED | — |
| TC-GDPR-01 | REQ-GDPR-01 | nominal | intégration (Testcontainers) | `frontend/tests/integration/account-deletion.test.ts` › effacer le compte efface le profil, les scores, les sauvegardes et la ligne du classement | PASSED | — |
| TC-GDPR-02 | REQ-GDPR-01 | nominal | E2E (3 navigateurs) | `frontend/e2e/compte.spec.ts` › un joueur supprime son compte après avoir retapé son pseudo (RGPD) | PASSED | BUG-02 |
| TC-GDPR-03 | REQ-GDPR-01 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/auth/AuthControllerTest.java` › deleteAccountErasesTheSupabaseAccountThenClosesTheSession | PASSED | — |
| TC-GDPR-04 | REQ-GDPR-01 | erreur | composant | `frontend/src/pages/ProfilePage.test.tsx` › si la suppression échoue, l’explique et reste sur le profil, connecté | PASSED | — |
| TC-GDPR-05 | REQ-GDPR-01 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/auth/AuthControllerTest.java` › deleteAccountWithoutSessionIsUnauthorized | PASSED | — |
| TC-GDPR-06 | REQ-GDPR-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/account-deletion.test.ts` › les données des autres joueurs restent intactes | PASSED | — |
| TC-GDPR-07 | REQ-GDPR-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/account-deletion.test.ts` › un joueur ne peut pas effacer son compte en contournant le backend | PASSED | — |
| TC-ERR-01 | REQ-ERR-01 | nominal | unitaire | `frontend/src/games/errors.test.ts` › laisse passer une GameError telle quelle | PASSED | — |
| TC-ERR-02 | REQ-ERR-01 | erreur | fuzzing (fast-check) | `frontend/src/games/errors.property.test.ts` › renvoie toujours une GameError dont le message est un des messages prévus pour le joueur | PASSED | — |
| TC-ERR-03 | REQ-ERR-01 | erreur | composant | `frontend/src/games/GameErrorBoundary.test.tsx` › remplace un jeu qui plante par un message, et le relance | PASSED | — |
| TC-ERR-04 | REQ-ERR-01 | erreur | E2E (3 navigateurs) | `frontend/e2e/lobby.spec.ts` › Supabase en panne : message lisible, le jeu reste jouable | PASSED | — |
| TC-A11Y-01 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/accessibilite.spec.ts` › conforme WCAG 2.1 AA | PASSED | — |
| TC-A11Y-02 | REQ-A11Y-01 | erreur | composant | `frontend/src/pages/LoginPage.test.tsx` › affiche sous le champ une erreur que le backend lui attribue | PASSED | — |
| TC-PERF-01 | REQ-PERF-01 | nominal | charge (k6, profil load) | `quality/k6/lobby.js` › load: (rate) | PASSED | — |
| TC-PERF-02 | REQ-PERF-01 | erreur | pic (k6, profil spike) | `quality/k6/lobby.js` › spike: (rate) | FAILED | BUG-03 |
| TC-RES-01 | REQ-RES-01 | nominal | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/scores/SupabaseScoresChaosTest.java` › aCutConnectionOpensTheCircuitAndItClosesAgainWhenSupabaseIsBack | PASSED | — |
| TC-RES-02 | REQ-RES-01 | erreur | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/scores/SupabaseScoresChaosTest.java` › aSlowSupabaseIsAbandonedAtTheTimeoutThenTheCircuitOpensAndAnswersAtOnce | PASSED | — |
| TC-RES-03 | REQ-RES-01 | erreur | unitaire (horloge simulée) | `backend/src/test/java/fr/tikigaming/resilience/CircuitBreakerTest.java` › aFailedTrialReopensForAFullDelay | PASSED | — |
| TC-SEC-01 | REQ-SEC-01 | nominal | intégration (Spring Security) | `backend/src/test/java/fr/tikigaming/config/SecurityConfigTest.java` › postWithTheCookieCopiedInTheHeaderIsAccepted | PASSED | — |
| TC-SEC-02 | REQ-SEC-01 | erreur | intégration (Spring Security) | `backend/src/test/java/fr/tikigaming/config/SecurityConfigTest.java` › deletingTheAccountWithoutCsrfTokenIsForbidden | PASSED | — |
| TC-SEC-03 | REQ-SEC-01 | erreur | unitaire | `frontend/security-headers.test.ts` › n’autorise ni script inline, ni eval, ni style inline | PASSED | — |
| TC-API-01 | REQ-API-01 | nominal | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › un joueur connecté enregistre le score de sa partie | PASSED | — |
| TC-API-02 | REQ-API-01 | erreur | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › un score au-dessus du maximum est refusé avec un message pour le joueur | PASSED | — |
| TC-API-03 | REQ-API-01 | nominal | contrat (Pact, provider) | `backend/src/test/java/fr/tikigaming/contract/PactProviderTest.java` › verifieLeContratDuFront | PASSED | — |
| TC-RH-01 | REQ-RH-01 | nominal | unitaire | `frontend/src/games/rush-hour/domain/moves.test.ts` › un véhicule plus loin arrête la voiture juste avant lui | PASSED | — |
| TC-RH-02 | REQ-RH-01 | erreur | unitaire | `frontend/src/games/rush-hour/domain/session.test.ts` › un glissement impossible est refusé et ne compte pas | PASSED | — |
| TC-RH-03 | REQ-RH-01 | erreur | unitaire (backend, mutation) | `backend/src/test/java/fr/tikigaming/games/rush_hour/SolutionVerifierTest.java` › replayRefusesAVehicleBackingIntoAnother | PASSED | — |
| TC-RH-04 | REQ-RH-01 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › un véhicule glissé trop loin s’arrête contre l’obstacle (R5) | PASSED | — |
| TC-RH-05 | REQ-RH-02 | nominal | unitaire | `frontend/src/games/rush-hour/domain/session.test.ts` › deux glissements de suite du même véhicule comptent 1 coup | PASSED | — |
| TC-RH-06 | REQ-RH-02 | erreur | unitaire | `frontend/src/games/rush-hour/domain/session.test.ts` › un aller-retour du même véhicule ne compte aucun coup | PASSED | — |
| TC-RH-07 | REQ-RH-02 | nominal | unitaire (backend, mutation) | `backend/src/test/java/fr/tikigaming/games/rush_hour/SolutionVerifierTest.java` › replayCountsAMergedMoveFollowedByAnotherVehicle | PASSED | — |
| TC-RH-08 | REQ-RH-03 | nominal | BDD | `frontend/src/games/rush-hour/features/fin-de-niveau.feature` › Le score d'un niveau dépend des coups en trop et des indices | PASSED | — |
| TC-RH-09 | REQ-RH-03 | erreur | unitaire (BVA) | `frontend/src/games/rush-hour/domain/score.test.ts` › refuse une partie jouée en moins de coups que le minimum | PASSED | — |
| TC-RH-10 | REQ-RH-03 | erreur | unitaire (BVA) | `frontend/src/games/rush-hour/domain/score.test.ts` › refuse un nombre d’indices négatif | PASSED | — |
| TC-RH-11 | REQ-RH-04 | nominal | unitaire (backend, MockMvc) | `backend/src/test/java/fr/tikigaming/games/rush_hour/RushHourControllerTest.java` › returnsTheScoreComputedByTheServer | PASSED | — |
| TC-RH-12 | REQ-RH-04 | erreur | unitaire (backend, MockMvc) | `backend/src/test/java/fr/tikigaming/games/rush_hour/RushHourControllerTest.java` › refusesACheatedGameWith422 | PASSED | — |
| TC-RH-13 | REQ-RH-04 | erreur | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › partie refusée par le serveur : le refus s’affiche, sans score ni envoi au classement | PASSED | — |
| TC-RH-14 | REQ-RH-04 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › le niveau 1 se gagne à la souris, et la partie est vérifiée par le serveur | PASSED | — |
| TC-RH-15 | REQ-RH-05 | nominal | BDD | `frontend/src/games/rush-hour/features/deblocage-des-niveaux.feature` › Un niveau est ouvert quand le précédent est terminé | PASSED | — |
| TC-RH-16 | REQ-RH-05 | erreur | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › au départ, seul le niveau 1 est ouvert | PASSED | — |
| TC-RH-17 | REQ-RH-05 | erreur | unitaire (Fakes) | `frontend/src/games/rush-hour/services/completeLevel.test.ts` › record de 800, score $label | PASSED | — |
| TC-RH-18 | REQ-RH-06 | nominal | unitaire (graine fixe) | `frontend/src/games/rush-hour/domain/generator.test.ts` › $difficulty, graine $seed : plateau valide, résoluble et de la bonne difficulté | PASSED | — |
| TC-RH-19 | REQ-RH-06 | nominal | unitaire (mutation) | `frontend/src/games/rush-hour/domain/generator.test.ts` › le tirage peut choisir la disposition n°$index | PASSED | — |
| TC-RH-20 | REQ-RH-06 | erreur | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › un plateau généré se gagne comme un niveau, mais ne compte pas au classement | PASSED | — |
| TC-RH-21 | REQ-RH-07 | nominal | unitaire | `frontend/src/games/rush-hour/domain/session.test.ts` › l’indice est le prochain coup de la solution la plus courte, et il est compté | PASSED | — |
| TC-RH-22 | REQ-RH-07 | erreur | unitaire (mutation) | `frontend/src/games/rush-hour/domain/session.test.ts` › plateau sans solution : pas d’indice, et rien n’est compté | PASSED | — |
| TC-RH-23 | REQ-RH-07 | nominal | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › chaque indice coûte 200 points au score du niveau | PASSED | — |
| TC-RH-24 | REQ-RH-08 | nominal | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › une flèche dans le sens du véhicule le déplace et compte un coup | PASSED | — |
| TC-RH-25 | REQ-RH-08 | erreur | composant | `frontend/src/games/rush-hour/RushHourGame.test.tsx` › une flèche dans l’autre axe ne fait rien | PASSED | — |
| TC-RH-26 | REQ-RH-08 | nominal | unitaire (BVA) | `frontend/src/games/rush-hour/components/drag.test.ts` › décalage de $offset case(s) → $delta | PASSED | BUG-04 |
| TC-RH-27 | REQ-RH-08 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › un glissé de moins d’une demi-case n’est pas un coup | PASSED | — |
| TC-RH-28 | REQ-RH-09 | nominal | contrat (front) | `frontend/src/games/rush-hour/contract.test.ts` › le jeu a exactement les niveaux du contrat, case par case | PASSED | — |
| TC-RH-29 | REQ-RH-09 | nominal | contrat (backend) | `backend/src/test/java/fr/tikigaming/games/rush_hour/ContractTest.java` › serverReplaysTheContractGames | PASSED | — |
| TC-RH-30 | REQ-RH-09 | erreur | contrat (front) | `frontend/src/games/rush-hour/contract.test.ts` › contrat partagé avec le serveur : parties rejouées | PASSED | — |
| TC-RH-31 | REQ-RH-01 | erreur | fuzzing (fast-check) | `frontend/src/games/rush-hour/domain/board.property.test.ts` › n’importe quelle grille est acceptée ou refusée avec un message prévu, sans autre erreur | PASSED | — |
| TC-RH-32 | REQ-RH-01 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/board.property.test.ts` › aller-retour : un plateau accepté, redessiné à partir de ses véhicules, redonne la même grille | PASSED | — |
| TC-RH-33 | REQ-RH-02 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/session.property.test.ts` › après n’importe quels coups légaux, tout annuler ramène au départ | PASSED | — |
| TC-RH-34 | REQ-RH-03 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/score.property.test.ts` › un coup en trop ou un indice de plus ne fait jamais monter le score | PASSED | — |
| TC-RH-35 | REQ-RH-08 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/components/drag.property.test.ts` › au lâcher, le véhicule va sur la case la plus proche, de la même façon dans les deux sens | PASSED | BUG-04 |
| TC-A11Y-03 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/accessibilite.spec.ts` › ['Rush Hour', '/games/rush-hour', 'Rush Hour'] | PASSED | BUG-05 |

## Anomalies

Titre au format `[Module][Action] observé au lieu de attendu`. Sévérité : S0 bloquante → S3 cosmétique ; priorité :
P0 immédiate → P3 basse (matrice dans [CONTRIBUTING.md](../CONTRIBUTING.md#anomalies)).

| Anomalie | Titre | Sévérité | Priorité | Statut | Correctif |
|----------|-------|----------|----------|--------|-----------|
| BUG-01 | [Inscription][Pseudo] un « À » décomposé (A + accent combinant) est cité comme un accent seul au lieu de la lettre entière | S3 | P2 | Closed | de8d841, trouvé par fast-check (bea7dd3) |
| BUG-02 | [Profil][Suppression du compte] le joueur arrive sur /login au lieu de l'accueil avec la confirmation | S2 | P1 | Closed | c8cad48, trouvé par l'E2E |
| BUG-03 | [Classement][Pic de charge ×10] P95 de 23 s et 8 % d'erreurs au lieu de P95 < 300 ms (environnement local) | S2 | P3 | Open | — |
| BUG-04 | [Rush Hour][Glisser-déposer] une demi-case vers la gauche ou le haut laisse le véhicule en place au lieu de le déplacer d'une case comme vers la droite ou le bas | S3 | P2 | Closed | 97f4fc24, trouvé par le test rouge de dropDelta (415d7f95) |
| BUG-05 | [Rush Hour][Choix du niveau] le nom lu des boutons de niveau (« Niveau 1, à jouer ») ne contient pas leur texte visible au lieu de le contenir (WCAG 2.5.3) | S2 | P2 | Closed | 87ad47ab, trouvé par l'audit axe (d8c9b25c) |
