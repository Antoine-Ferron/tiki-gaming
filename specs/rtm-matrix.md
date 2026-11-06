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
| REQ-PERF-01 | Le classement, l'envoi de score, la session et la vérification d'une partie de Rush Hour répondent en P95 < 300 ms et P99 < 500 ms, avec moins de 1 % d'erreurs | SLO (docs/slo.md) |
| REQ-RES-01 | Une panne de Supabase est abandonnée au timeout puis coupée par un disjoncteur, et le service revient seul | SLO, résilience (docs/slo.md) |
| REQ-SEC-01 | Les requêtes qui modifient des données exigent le jeton CSRF ; le front envoie les en-têtes de sécurité (CSP…) | OWASP |
| REQ-API-01 | Le backend respecte le contrat d'API attendu par le front (forme des requêtes et réponses) | Intégration front/back |
| REQ-MM-01 | Le feedback compte correctement les couleurs exactes et mal placées, y compris les répétitions | Règles du Mastermind |
| REQ-MM-02 | Une partie gagne, perd après dix essais, puis révèle le secret uniquement à la fin | Règles du Mastermind |
| REQ-MM-03 | Une partie expirée est supprimée et une partie redémarrée repart sans historique | Robustesse du jeu |
| REQ-MM-04 | Une partie est isolée par client et ses entrées sont validées côté serveur | Sécurité de l'API Mastermind |
| REQ-MM-05 | Les invariants du feedback, des couleurs et du score restent vrais sur des entrées générées | Qualité du domaine |
| REQ-MM-06 | Les parcours critiques du joueur sont accessibles au clavier et résistent aux erreurs réseau | Expérience joueur |
| REQ-MM-07 | Les endpoints Mastermind respectent les objectifs de latence et d'erreurs | SLO Mastermind |
| REQ-RH-01 | Rush Hour : un véhicule ne glisse que dans son sens, sans traverser les bords ni les autres véhicules | Règles R4, R5 (docs/games/rush-hour/regles.md) |
| REQ-RH-02 | Rush Hour : un coup = un glissement d'un véhicule, quelle que soit la distance ; les glissements successifs du même véhicule forment un seul coup | Règle R6 |
| REQ-RH-03 | Rush Hour : le score d'un niveau suit le barème (coups en trop, indices), jamais négatif, et refuse une partie impossible | Score § 7 |
| REQ-RH-04 | Rush Hour : le serveur rejoue les coups d'un niveau, calcule lui-même le score et refuse une partie truquée | Anti-triche S6 |
| REQ-RH-05 | Rush Hour : seul le niveau 1 est ouvert au départ ; terminer un niveau ouvre le suivant ; un record ne baisse jamais | Progression N3, N5 |
| REQ-RH-06 | Rush Hour : un plateau généré est résoluble, de la difficulté demandée, et ne compte pas au classement | Génération G2, G3, S4 |
| REQ-RH-07 | Rush Hour : un indice donne le prochain coup de la solution la plus courte et coûte des points | Indices P5 |
| REQ-RH-08 | Rush Hour : on joue à la souris (glisser-déposer calé sur une case) et au clavier (flèches dans le sens du véhicule) | Contrôles C1, C2 |
| REQ-RH-09 | Rush Hour : le jeu et le serveur appliquent les mêmes niveaux, les mêmes règles et le même barème | Contrat partagé (shared/games/rush-hour/contrat.json) |
| REQ-RH-10 | Rush Hour : un client ne peut pas faire vérifier plus de 60 parties par minute (429 au-delà), sans gêner les autres | Sécurité, OWASP API4 (docs/games/rush-hour/rapport-securite.md) |
| REQ-TTT-06 | Tic-Tac-Toe : la grille et les annonces de partie sont utilisables au clavier et sans violation WCAG sérieuse ou critique | Accessibilité |
| REQ-TTT-01 | Tic-Tac-Toe : la page affiche une grille 3×3 jouable | Interface du jeu |
| REQ-TTT-02 | Tic-Tac-Toe : les joueurs X et O jouent à tour de rôle et une case occupée ne peut pas être rejouée | Règles du jeu |
| REQ-TTT-03 | Tic-Tac-Toe : une ligne, colonne ou diagonale complète termine la partie avec le bon gagnant | Règles du jeu |
| REQ-TTT-04 | Tic-Tac-Toe : une grille pleine sans ligne gagnante affiche un match nul | Règles du jeu |
| REQ-TTT-05 | Tic-Tac-Toe : le score de session compte les victoires X, les victoires O et les matchs nuls, et survit à Rejouer | Expérience joueur |
| REQ-PRIS-01 | Prismine : un tir coûte une dose d'huile et révèle le trajet du faisceau ; il est refusé sur un bord déjà exploré ou lampe vide | Règles du jeu |
| REQ-PRIS-02 | Prismine : le faisceau suit les règles d'optique (quart de tour sur la face en biais, retour sur les faces plates, couleurs, obsidienne) sur des étages déterministes et solubles | Règles du jeu |
| REQ-PRIS-03 | Prismine : une carte juste fait descendre et remplit la lampe ; une carte fausse coûte trois doses ou éteint la lampe, une carte contredite ne coûte rien | Règles du jeu |
| REQ-PRIS-04 | Prismine : seul le serveur calcule le score (100 points par étage, +50 % sans erreur) ; un score envoyé par un joueur est refusé | Anti-triche |
| REQ-PRIS-05 | Prismine : la carte cachée et les expéditions restent côté serveur, illisibles et non modifiables par les joueurs, et sont effacées avec le compte | Anti-triche, RGPD |
| REQ-PRIS-06 | Prismine : un joueur a une seule expédition en cours, qu'il reprend après un rechargement ; une requête illisible ou visant l'expédition d'un autre est refusée | Expérience joueur, sécurité |
| REQ-PRIS-07 | Prismine : un étage validé en moins de 5 s est signalé une seule fois à l'audit, et une expédition inactive depuis plus de 24 h est purgée | Anti-triche, exploitation |
| REQ-PRIS-08 | Prismine : le score d'un joueur est classé une seule fois avec sa durée, jamais pour un invité, et une panne de stockage est signalée | Règles du classement |
| REQ-PRIS-09 | Prismine : quand Supabase tombe, les appels lents sont abandonnés, le disjoncteur répond 503 sans attendre et se referme au retour du service | Résilience (docs/slo.md) |
| REQ-PRIS-10 | Prismine : le front et le serveur arbitre respectent le même contrat d'API, sans la carte cachée | Contrat Pact |
| REQ-LEM-01 | LemurTiki : le maki rebondit sur une branche touchée en descendant (selon sa largeur), la traverse en montant, et les bords de l'écran sont reliés | EF-1.2 à EF-1.6 (docs/games/lemur/specification.md) |
| REQ-LEM-02 | LemurTiki : la caméra suit le maki qui dépasse le milieu de l'écran et ne redescend jamais | EF-2 |
| REQ-LEM-03 | LemurTiki : une branche est toujours à portée de saut et dans l'écran ; les branches passées sous l'écran disparaissent | EF-3.1, EF-3.2 |
| REQ-LEM-04 | LemurTiki : la fossa accélère tous les 100 m jusqu'à 20 m/s et ne reste jamais à plus de 40 m sous l'écran | EF-5.2, EF-5.3 |
| REQ-LEM-05 | LemurTiki : la partie se termine quand le maki tombe sous l'écran ou que la fossa l'attrape, puis plus rien ne bouge | EF-6.1 à EF-6.3 |
| REQ-LEM-06 | LemurTiki : le score vaut les mètres entiers atteints + 10 par gousse de vanille, plafonné à 100 000 | EF-6.4, EF-6.5 |
| REQ-LEM-07 | LemurTiki : le score d'une partie terminée part une seule fois au classement ; un invité est invité à se connecter ; une panne affiche un message sans empêcher de rejouer | EF-8.1, EF-8.3, EF-8.5 |
| REQ-LEM-08 | LemurTiki : une partie commence au pied du baobab, se dirige au clavier (AZERTY et QWERTY), se met en pause (aussi quand l'onglet est masqué) et se termine sur un écran de fin qui permet de rejouer | EF-1.1, EF-5.1, EF-7.1 à EF-7.7 |
| REQ-GTA-01 | MiniGTA : la ville est la même pour tous (graine fixe) et le GPS mène exactement à la destination | Règle R1 (docs/games/mini-gta/regles.md) |
| REQ-GTA-02 | MiniGTA : une nouvelle partie commence avec 500 $, sans armure ; une sauvegarde corrompue ou d'une autre version donne une nouvelle partie | Règle R2, Sauvegarde |
| REQ-GTA-03 | MiniGTA : chaque mission paie sa récompense une seule fois (800, 1 500, 2 500, 3 000 $) | Règle R3 |
| REQ-GTA-04 | MiniGTA : les billets ramassés s'ajoutent à l'argent et au score, une seule fois | Règle R4 |
| REQ-GTA-05 | MiniGTA : l'armurerie vend au prix affiché ; un achat sans les fonds est refusé, sans débit | Règle R5 |
| REQ-GTA-06 | MiniGTA : les crimes vus font monter le niveau de recherche (1 à 5 étoiles), qui retombe hors de vue | Règle R6 |
| REQ-GTA-07 | MiniGTA : frais d'hôpital (10 %, 100 $ min.) ou caution (15 %, 200 $ min.) sans solde négatif ; l'arrestation coûte les armes | Règle R7 |
| REQ-GTA-08 | MiniGTA : le score est tout l'argent gagné, jamais diminué par les dépenses, plafonné à 1 000 000 et envoyé s'il bat le précédent | Règle R8 |
| REQ-GTA-09 | MiniGTA : des tremplins de chaque matière, hors des routes du trafic, des bâtiments et de l'eau | Règle R9 |
| REQ-GTA-10 | MiniGTA : environ un bâtiment ordinaire sur cinq a un rez-de-chaussée accessible, porte côté rue | Règle R10 |
| REQ-GTA-11 | MiniGTA : l'accueil propose de jouer ou de continuer en invité, et explique qu'il faut un ordinateur sur un écran trop étroit | Plateforme (regles.md § 3) |

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
| TC-PERF-03 | REQ-PERF-01 | nominal | charge (k6, profil load) | `quality/k6/lobby.js` › rush_hour_verify: scenario('verifyRushHourLevel', 20) | PASSED | BUG-06 |
| TC-RES-01 | REQ-RES-01 | nominal | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/scores/SupabaseScoresChaosTest.java` › aCutConnectionOpensTheCircuitAndItClosesAgainWhenSupabaseIsBack | PASSED | — |
| TC-RES-02 | REQ-RES-01 | erreur | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/scores/SupabaseScoresChaosTest.java` › aSlowSupabaseIsAbandonedAtTheTimeoutThenTheCircuitOpensAndAnswersAtOnce | PASSED | — |
| TC-RES-03 | REQ-RES-01 | erreur | unitaire (horloge simulée) | `backend/src/test/java/fr/tikigaming/resilience/CircuitBreakerTest.java` › aFailedTrialReopensForAFullDelay | PASSED | — |
| TC-SEC-01 | REQ-SEC-01 | nominal | intégration (Spring Security) | `backend/src/test/java/fr/tikigaming/config/SecurityConfigTest.java` › postWithTheCookieCopiedInTheHeaderIsAccepted | PASSED | — |
| TC-SEC-02 | REQ-SEC-01 | erreur | intégration (Spring Security) | `backend/src/test/java/fr/tikigaming/config/SecurityConfigTest.java` › deletingTheAccountWithoutCsrfTokenIsForbidden | PASSED | — |
| TC-SEC-03 | REQ-SEC-01 | erreur | unitaire | `frontend/security-headers.test.ts` › n’autorise ni script inline, ni eval, ni style inline | PASSED | — |
| TC-API-01 | REQ-API-01 | nominal | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › un joueur connecté enregistre le score de sa partie | PASSED | — |
| TC-API-02 | REQ-API-01 | erreur | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › un score au-dessus du maximum est refusé avec un message pour le joueur | PASSED | — |
| TC-API-03 | REQ-API-01 | nominal | contrat (Pact, provider) | `backend/src/test/java/fr/tikigaming/contract/PactProviderTest.java` › verifieLeContratDuFront | PASSED | — |
| TC-MM-01 | REQ-MM-01 | nominal | BDD | `docs/games/mastermind/mastermind.feature` › Couleurs répétées | PASSED | — |
| TC-MM-02 | REQ-MM-01 | erreur | unitaire | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindGameTest.java` › calculatesFeedbackIncludingRepeatedColors | PASSED | — |
| TC-MM-03 | REQ-MM-02 | nominal | BDD | `docs/games/mastermind/mastermind.feature` › Victoire dès la première proposition | PASSED | — |
| TC-MM-04 | REQ-MM-02 | erreur | unitaire | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindGameTest.java` › losesAfterTenIncorrectGuessesAndRejectsTheEleventh | PASSED | — |
| TC-MM-05 | REQ-MM-03 | nominal | BDD | `docs/games/mastermind/mastermind.feature` › Redémarrage | PASSED | — |
| TC-MM-06 | REQ-MM-03 | erreur | unitaire | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindServiceTest.java` › expiresUnplayedGameQuickly | PASSED | — |
| TC-MM-07 | REQ-MM-04 | nominal | intégration (Spring MockMvc) | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindControllerTest.java` › returns400ForUnknownColor | PASSED | — |
| TC-MM-08 | REQ-MM-04 | erreur | unitaire | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindServiceTest.java` › rejectsAccessFromAnotherClient | PASSED | — |
| TC-MM-09 | REQ-MM-05 | nominal | propriété (fuzzing déterministe) | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindGameTest.java` › feedbackPropertiesHoldForManyGeneratedCodes | PASSED | — |
| TC-MM-10 | REQ-MM-05 | erreur | propriété (fuzzing déterministe) | `backend/src/test/java/fr/tikigaming/games/mastermind/MastermindGameTest.java` › generatedGameUsesOnlyDeclaredColorsAndKeepsScoreBounded | PASSED | — |
| TC-MM-11 | REQ-MM-06 | nominal | E2E Playwright | `frontend/e2e/mastermind.spec.ts` › supports keyboard selection and resumes after reload | PASSED | — |
| TC-MM-12 | REQ-MM-06 | erreur | E2E Playwright | `frontend/e2e/mastermind.spec.ts` › displays an API error without breaking the board | PASSED | — |
| TC-MM-13 | REQ-MM-07 | nominal | charge k6 | `quality/k6/mastermind.js` › seuils des endpoints Mastermind | PASSED | — |
| TC-MM-14 | REQ-MM-07 | erreur | charge k6 | `quality/k6/mastermind.js` › erreurs sous 1 pour cent | PASSED | — |
| TC-API-04 | REQ-API-01 | nominal | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › une partie gagnée est rejouée par le serveur, qui renvoie le score, les coups et le minimum | PASSED | — |
| TC-API-05 | REQ-API-01 | erreur | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › une partie truquée est refusée (422) avec un message que le jeu affiche | PASSED | — |
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
| TC-TTT-11 | REQ-TTT-06 | nominal | E2E + axe-core | `frontend/e2e/tic-tac-toe.spec.ts` › reste accessible au clavier et sans violation WCAG critique | PASSED | — |
| TC-TTT-12 | REQ-TTT-06 | erreur | E2E + axe-core | `frontend/e2e/tic-tac-toe.spec.ts` › reste accessible au clavier et sans violation WCAG critique | PASSED | — |
| TC-TTT-01 | REQ-TTT-01 | nominal | E2E Playwright | `frontend/e2e/tic-tac-toe.spec.ts` › joue une partie et affiche le gagnant et le score de session | PASSED | — |
| TC-TTT-02 | REQ-TTT-01 | erreur | E2E Playwright | `frontend/e2e/tic-tac-toe.spec.ts` › rejoue une partie en conservant le score de session | PASSED | — |
| TC-TTT-03 | REQ-TTT-02 | nominal | composant | `frontend/src/games/tic-tac-toe/TicTacToeGame.test.tsx` › allows alternating moves on the board | PASSED | — |
| TC-TTT-04 | REQ-TTT-02 | erreur | composant | `frontend/src/games/tic-tac-toe/TicTacToeGame.test.tsx` › announces a winner and disables the board after three aligned moves | PASSED | — |
| TC-TTT-05 | REQ-TTT-03 | nominal | composant | `frontend/src/games/tic-tac-toe/TicTacToeGame.test.tsx` › announces a winner and disables the board after three aligned moves | PASSED | — |
| TC-TTT-06 | REQ-TTT-03 | erreur | BDD | `frontend/src/games/tic-tac-toe/features/tictactoe.feature` › Une ligne, colonne ou diagonale donne la victoire | PASSED | — |
| TC-TTT-07 | REQ-TTT-04 | nominal | BDD | `frontend/src/games/tic-tac-toe/features/tictactoe.feature` › Une grille pleine sans ligne gagnante est un match nul | PASSED | — |
| TC-TTT-08 | REQ-TTT-04 | erreur | BDD | `frontend/src/games/tic-tac-toe/features/tictactoe.feature` › Une case occupée ou des coordonnées invalides sont refusées | PASSED | — |
| TC-TTT-09 | REQ-TTT-05 | nominal | composant | `frontend/src/games/tic-tac-toe/TicTacToeGame.test.tsx` › updates the session score after a win and keeps it after replay | PASSED | — |
| TC-TTT-10 | REQ-TTT-05 | erreur | E2E Playwright | `frontend/e2e/tic-tac-toe.spec.ts` › rejoue une partie en conservant le score de session | PASSED | — |
| TC-RH-28 | REQ-RH-09 | nominal | contrat (front) | `frontend/src/games/rush-hour/contract.test.ts` › le jeu a exactement les niveaux du contrat, case par case | PASSED | — |
| TC-RH-29 | REQ-RH-09 | nominal | contrat (backend) | `backend/src/test/java/fr/tikigaming/games/rush_hour/ContractTest.java` › serverReplaysTheContractGames | PASSED | — |
| TC-RH-30 | REQ-RH-09 | erreur | contrat (front) | `frontend/src/games/rush-hour/contract.test.ts` › contrat partagé avec le serveur : parties rejouées | PASSED | — |
| TC-RH-31 | REQ-RH-01 | erreur | fuzzing (fast-check) | `frontend/src/games/rush-hour/domain/board.property.test.ts` › n’importe quelle grille est acceptée ou refusée avec un message prévu, sans autre erreur | PASSED | — |
| TC-RH-32 | REQ-RH-01 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/board.property.test.ts` › aller-retour : un plateau accepté, redessiné à partir de ses véhicules, redonne la même grille | PASSED | — |
| TC-RH-33 | REQ-RH-02 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/session.property.test.ts` › après n’importe quels coups légaux, tout annuler ramène au départ | PASSED | — |
| TC-RH-34 | REQ-RH-03 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/domain/score.property.test.ts` › un coup en trop ou un indice de plus ne fait jamais monter le score | PASSED | — |
| TC-RH-35 | REQ-RH-08 | nominal | propriété (fast-check) | `frontend/src/games/rush-hour/components/drag.property.test.ts` › au lâcher, le véhicule va sur la case la plus proche, de la même façon dans les deux sens | PASSED | BUG-04 |
| TC-RH-36 | REQ-RH-10 | nominal | unitaire (BVA, horloge injectée) | `backend/src/test/java/fr/tikigaming/games/rush_hour/ResultRateLimiterTest.java` › aNewMinuteGivesTheClientNewRequests | PASSED | — |
| TC-RH-37 | REQ-RH-10 | erreur | unitaire (backend, MockMvc) | `backend/src/test/java/fr/tikigaming/games/rush_hour/RushHourRateLimitTest.java` › aClientOverTheLimitIsRefusedWith429 | PASSED | — |
| TC-RH-38 | REQ-RH-10 | nominal | unitaire (backend, MockMvc) | `backend/src/test/java/fr/tikigaming/games/rush_hour/RushHourRateLimitTest.java` › anotherClientIsNotAffected | PASSED | — |
| TC-RH-39 | REQ-RH-05 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › gagner le niveau 1 ouvre le niveau 2, et la progression survit au rechargement | PASSED | — |
| TC-RH-40 | REQ-RH-08 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › le niveau 1 se gagne au clavier seul (accessibilité) | PASSED | — |
| TC-RH-41 | REQ-RH-07 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › un indice montre le coup à jouer, et le serveur reçoit l’indice utilisé | PASSED | — |
| TC-RH-42 | REQ-RH-04 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › une partie refusée par le serveur affiche le refus, sans score | PASSED | — |
| TC-RH-43 | REQ-RH-10 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › trop de parties envoyées : le joueur voit le message du serveur (429) | PASSED | — |
| TC-RH-44 | REQ-RH-06 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › un plateau généré en Facile se joue, avec un minimum de 3 à 8 coups | PASSED | — |
| TC-RH-45 | REQ-RH-05 | nominal | intégration (Testcontainers) | `frontend/tests/integration/rush-hour.test.ts` › un joueur sauvegarde sa progression Rush Hour et la relit à l’identique | PASSED | — |
| TC-RH-46 | REQ-RH-05 | erreur | intégration (Testcontainers) | `frontend/tests/integration/rush-hour.test.ts` › un joueur ne voit pas la progression Rush Hour d’un autre | PASSED | — |
| TC-RH-47 | REQ-SCORE-01 | erreur | intégration (Testcontainers) | `frontend/tests/integration/rush-hour.test.ts` › refuse un score total de 20 001 (> 20 000), même envoyé par le backend | PASSED | — |
| TC-RH-48 | REQ-RH-05 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › rejouer un niveau moins bien ne fait pas baisser le record | PASSED | — |
| TC-RH-49 | REQ-RH-08 | nominal | E2E (téléphone, 375 px) | `frontend/e2e/rush-hour.spec.ts` › le plateau tient dans l’écran et le niveau 1 se gagne au glisser-déposer | PASSED | — |
| TC-RH-50 | REQ-RH-06 | nominal | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › a le minimum de coups de sa difficulté | PASSED | — |
| TC-RH-51 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/rush-hour.spec.ts` › aucune violation d’accessibilité pendant une partie, ni sur l’écran de victoire | PASSED | — |
| TC-RH-52 | REQ-ERR-01 | erreur | E2E (3 navigateurs) | `frontend/e2e/rush-hour.spec.ts` › serveur en panne : un message lisible, et les niveaux restent jouables | PASSED | — |
| TC-A11Y-03 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/accessibilite.spec.ts` › ['Rush Hour', '/games/rush-hour', 'Rush Hour'] | PASSED | BUG-05 |
| TC-PRIS-01 | REQ-PRIS-01 | nominal | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Un tir coûte une dose d'huile et révèle le trajet du faisceau | PASSED | — |
| TC-PRIS-02 | REQ-PRIS-01 | erreur | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Un bord déjà exploré ne peut pas être retenté | PASSED | — |
| TC-PRIS-03 | REQ-PRIS-01 | erreur | BDD (Gherkin, BVA) | `backend/src/test/resources/features/prismine/expedition.feature` › Il faut au moins une dose pour tirer (<huile> en réserve) | PASSED | — |
| TC-PRIS-04 | REQ-PRIS-01 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/ExpeditionTest.java` › probeCostsOilAndIsRefusedOnAKnownEntryOrWithAnEmptyLamp | PASSED | — |
| TC-PRIS-05 | REQ-PRIS-02 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/EngineTest.java` › prismTurnsTheBeamOnItsHypotenuseAndSendsItBackOnItsFlatSides | PASSED | — |
| TC-PRIS-06 | REQ-PRIS-02 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/FloorsTest.java` › generatesDeterministicSolvableFloorsWithReversibleBeams | PASSED | — |
| TC-PRIS-07 | REQ-PRIS-02 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/EngineTest.java` › beamStartsWhiteMixesPrismColorsAndIsAbsorbedByObsidian | PASSED | — |
| TC-PRIS-08 | REQ-PRIS-03 | nominal | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Un étage réussi fait descendre et remplit la lampe | PASSED | — |
| TC-PRIS-09 | REQ-PRIS-03 | erreur | BDD (Gherkin, BVA) | `backend/src/test/resources/features/prismine/expedition.feature` › Une carte fausse coûte trois doses, sinon la lampe s'éteint (<huile> en réserve) | PASSED | — |
| TC-PRIS-10 | REQ-PRIS-03 | erreur | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Une carte qui contredit un tir ne coûte rien | PASSED | — |
| TC-PRIS-11 | REQ-PRIS-03 | erreur | E2E (3 navigateurs) | `frontend/e2e/prismine.spec.ts` › une carte contredite, puis fausse, et enfin une lampe éteinte | PASSED | — |
| TC-PRIS-12 | REQ-PRIS-04 | nominal | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Un étage rapporte 100 points par niveau, plus 50 % sans erreur | PASSED | — |
| TC-PRIS-13 | REQ-PRIS-04 | nominal | E2E (3 navigateurs) | `frontend/e2e/prismine.spec.ts` › un invité joue une expédition complète, sans jamais envoyer de score | PASSED | — |
| TC-PRIS-14 | REQ-PRIS-04 | erreur | BDD (Gherkin) | `backend/src/test/resources/features/prismine/expedition.feature` › Un joueur ne peut pas déclarer lui-même son score | PASSED | — |
| TC-PRIS-15 | REQ-PRIS-04 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineScoreValidatorTest.java` › refusesEveryScoreSentByAPlayer | PASSED | — |
| TC-PRIS-16 | REQ-PRIS-05 | nominal | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › la suppression du compte efface ses expéditions | PASSED | — |
| TC-PRIS-17 | REQ-PRIS-05 | nominal | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › une expédition d’invité n’a pas de compte rattaché | PASSED | — |
| TC-PRIS-18 | REQ-PRIS-05 | erreur | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › un joueur ne peut pas lire sa propre expédition (la carte cachée reste secrète) | PASSED | — |
| TC-PRIS-19 | REQ-PRIS-05 | erreur | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › un visiteur non connecté ne peut pas lire les expéditions | PASSED | — |
| TC-PRIS-20 | REQ-PRIS-05 | erreur | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › un joueur ne peut ni créer, ni modifier, ni effacer une expédition | PASSED | — |
| TC-PRIS-21 | REQ-PRIS-06 | nominal | E2E (3 navigateurs) | `frontend/e2e/prismine.spec.ts` › une expédition en cours se reprend après un rechargement de la page | PASSED | — |
| TC-PRIS-22 | REQ-PRIS-06 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineServiceTest.java` › stubbedSeedsAndInMemoryRegistryKeepOneSafeLiveRunPerPlayer | PASSED | — |
| TC-PRIS-23 | REQ-PRIS-06 | erreur | unitaire (backend, MockMvc) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineControllerTest.java` › refusesAnUnreadableMapAnotherPlayersRunAndTooManyStarts | PASSED | — |
| TC-PRIS-24 | REQ-PRIS-07 | nominal | unitaire (BVA, horloge injectée) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineServiceTest.java` › clockDrivesTheAuditThresholdAndTheRunPurgeWithoutSleeping | PASSED | — |
| TC-PRIS-25 | REQ-PRIS-07 | nominal | intégration (Testcontainers) | `frontend/tests/integration/prismine-runs.test.ts` › chaque mise à jour rafraîchit updated_at (base de la purge des expéditions inactives) | PASSED | — |
| TC-PRIS-26 | REQ-PRIS-07 | erreur | unitaire (simulacre) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineServiceTest.java` › auditsAnExpeditionOnlyOnceWhenFloorsAreClearedTooFast | PASSED | — |
| TC-PRIS-27 | REQ-PRIS-08 | nominal | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineServiceTest.java` › recordsTheScoreWithItsDurationForAPlayerButNotForAGuest | PASSED | — |
| TC-PRIS-28 | REQ-PRIS-08 | erreur | unitaire (backend) | `backend/src/test/java/fr/tikigaming/games/prismine/SupabaseAdaptersTest.java` › storesRunsAndScoresInSupabaseAndReportsItsFailures | PASSED | — |
| TC-PRIS-29 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/prismine.spec.ts` › l’écran de jeu est conforme WCAG 2.1 AA | PASSED | — |
| TC-PRIS-30 | REQ-ERR-01 | erreur | E2E (3 navigateurs) | `frontend/e2e/prismine.spec.ts` › un refus du serveur est expliqué au joueur, qui peut continuer | PASSED | — |
| TC-PRIS-31 | REQ-PRIS-01 | erreur | unitaire (BVA) | `backend/src/test/java/fr/tikigaming/games/prismine/ExpeditionTest.java` › refusesAnEntryOutsideTheGalleryAtBothBoundaries | PASSED | — |
| TC-PRIS-32 | REQ-PRIS-06 | erreur | intégration (MockMvc, BOLA) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineControllerTest.java` › anotherPlayerCanNeitherReadNorPlayNorEndARun | PASSED | — |
| TC-PRIS-33 | REQ-PRIS-06 | erreur | unitaire (horloge injectée) | `backend/src/test/java/fr/tikigaming/games/prismine/StartLimiterTest.java` › theConfiguredLimitIsAppliedPerAddress | PASSED | — |
| TC-PRIS-34 | REQ-PRIS-09 | nominal | unitaire (horloge injectée) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineSupabaseBreakerTest.java` › theCircuitClosesAfterTheDelayOnceSupabaseIsBack | PASSED | — |
| TC-PRIS-35 | REQ-PRIS-09 | erreur | unitaire (horloge injectée) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineSupabaseBreakerTest.java` › consecutiveOutagesOpenTheCircuitWhichAnswers503WithoutCallingSupabase | PASSED | — |
| TC-PRIS-36 | REQ-PRIS-09 | erreur | unitaire (horloge injectée) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineSupabaseBreakerTest.java` › aBusinessRefusalProvesSupabaseAnswersAndNeverOpensTheCircuit | PASSED | — |
| TC-PRIS-37 | REQ-PRIS-09 | erreur | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineSupabaseChaosTest.java` › aSlowSupabaseIsAbandonedAtTheTimeoutThenTheCircuitAnswersAtOnce | PASSED | — |
| TC-PRIS-38 | REQ-PRIS-09 | nominal | chaos (Toxiproxy) | `backend/src/test/java/fr/tikigaming/games/prismine/PrismineSupabaseChaosTest.java` › aCutConnectionOpensTheCircuitAndItClosesWhenSupabaseIsBack | PASSED | — |
| TC-PRIS-39 | REQ-PRIS-10 | nominal | contrat (Pact, consommateur) | `frontend/tests/contract/prismine.pact.test.ts` › commencer une expédition | PASSED | — |
| TC-PRIS-40 | REQ-PRIS-10 | nominal | contrat (Pact, consommateur) | `frontend/tests/contract/prismine.pact.test.ts` › envoyer un faisceau ajoute un tir au journal | PASSED | — |
| TC-PRIS-41 | REQ-PRIS-10 | erreur | contrat (Pact, consommateur) | `frontend/tests/contract/prismine.pact.test.ts` › un tir hors de la galerie répond 400 avec un message | PASSED | — |
| TC-PRIS-42 | REQ-PRIS-10 | erreur | contrat (Pact, consommateur) | `frontend/tests/contract/prismine.pact.test.ts` › une carte illisible répond 400 sur le champ guess | PASSED | — |
| TC-PRIS-43 | REQ-PRIS-10 | nominal | contrat (Pact, fournisseur) | `backend/src/test/java/fr/tikigaming/games/prismine/PrisminePactProviderTest.java` › verifiesThePrismineFrontendContract | PASSED | — |
| TC-LEM-01 | REQ-LEM-01 | nominal | BDD | `frontend/src/games/lemur/features/deplacement.feature` › Le maki rebondit sur une branche touchée en descendant | PASSED | — |
| TC-LEM-02 | REQ-LEM-01 | erreur | BDD | `frontend/src/games/lemur/features/deplacement.feature` › Le maki traverse une branche en montant | PASSED | — |
| TC-LEM-03 | REQ-LEM-01 | nominal | BDD | `frontend/src/games/lemur/features/deplacement.feature` › Le joueur dirige le maki, et les bords sont reliés | PASSED | — |
| TC-LEM-04 | REQ-LEM-01 | erreur | unitaire (BVA) | `frontend/src/games/lemur/domain/game.test.ts` › $cas (x = $x) → rebond : $attendu | PASSED | — |
| TC-LEM-05 | REQ-LEM-01 | erreur | unitaire (BVA) | `frontend/src/games/lemur/domain/game.test.ts` › bord relié — $cas (x = $x) → rebond : $attendu | PASSED | — |
| TC-LEM-06 | REQ-LEM-01 | nominal | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › le maki reste toujours dans la largeur de l'écran, quelle que soit la direction (EF-1.5) | PASSED | — |
| TC-LEM-07 | REQ-LEM-02 | nominal | BDD | `frontend/src/games/lemur/features/camera.feature` › La caméra suit le maki qui dépasse le milieu de l'écran | PASSED | — |
| TC-LEM-08 | REQ-LEM-02 | erreur | BDD | `frontend/src/games/lemur/features/camera.feature` › La caméra ne redescend jamais | PASSED | — |
| TC-LEM-09 | REQ-LEM-02 | erreur | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › la caméra et la hauteur maximale ne redescendent jamais (EF-2, EF-6.4) | PASSED | — |
| TC-LEM-10 | REQ-LEM-03 | nominal | BDD | `frontend/src/games/lemur/features/branches.feature` › Des branches attendent toujours au-dessus de l'écran | PASSED | — |
| TC-LEM-11 | REQ-LEM-03 | erreur | BDD | `frontend/src/games/lemur/features/branches.feature` › Les branches passées sous l'écran disparaissent | PASSED | — |
| TC-LEM-12 | REQ-LEM-03 | nominal | BDD | `frontend/src/games/lemur/features/branches.feature` › Une branche est toujours à portée de saut | PASSED | — |
| TC-LEM-13 | REQ-LEM-03 | nominal | unitaire (BVA) | `frontend/src/games/lemur/domain/branches.test.ts` › à $hauteur m avec le tirage $tirage → $ecart m | PASSED | — |
| TC-LEM-14 | REQ-LEM-03 | erreur | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › les branches restent à portée de saut et dans la largeur de l’écran, pour tout tirage (EF-3.2) | PASSED | — |
| TC-LEM-15 | REQ-LEM-04 | nominal | BDD | `frontend/src/games/lemur/features/fossa.feature` › La fossa accélère avec la hauteur, jusqu'à un maximum | PASSED | — |
| TC-LEM-16 | REQ-LEM-04 | erreur | BDD | `frontend/src/games/lemur/features/fossa.feature` › La fossa ne reste jamais à plus de 40 m sous l'écran | PASSED | — |
| TC-LEM-17 | REQ-LEM-04 | nominal | unitaire (BVA) | `frontend/src/games/lemur/domain/fossa.test.ts` › maki monté à $hauteur m → $vitesse m/s | PASSED | — |
| TC-LEM-18 | REQ-LEM-04 | erreur | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › la fossa ne ralentit jamais en montant, et reste entre 4 et 20 m/s (EF-5.2) | PASSED | — |
| TC-LEM-19 | REQ-LEM-05 | erreur | BDD | `frontend/src/games/lemur/features/fin.feature` › Le maki tombe sous l'écran | PASSED | — |
| TC-LEM-20 | REQ-LEM-05 | erreur | BDD | `frontend/src/games/lemur/features/fin.feature` › La fossa rattrape le maki | PASSED | — |
| TC-LEM-21 | REQ-LEM-05 | nominal | BDD | `frontend/src/games/lemur/features/fin.feature` › Après la fin, plus rien ne bouge | PASSED | — |
| TC-LEM-22 | REQ-LEM-05 | nominal | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › une partie terminée ne change plus, quoi que fasse le joueur (EF-6.3) | PASSED | — |
| TC-LEM-23 | REQ-LEM-05 | nominal | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › une partie en cours avance toujours : la gravité ou un rebond change la vitesse du maki (EF-1) | PASSED | — |
| TC-LEM-24 | REQ-LEM-06 | nominal | BDD | `frontend/src/games/lemur/features/score.feature` › Le score compte la hauteur maximale et la vanille | PASSED | — |
| TC-LEM-25 | REQ-LEM-06 | nominal | BDD | `frontend/src/games/lemur/features/score.feature` › La hauteur maximale suit le maki sans jamais redescendre | PASSED | — |
| TC-LEM-26 | REQ-LEM-06 | erreur | propriété (fast-check) | `frontend/src/games/lemur/domain/lemur.property.test.ts` › le score est un entier entre 0 et 100 000, qui ne baisse pas quand on monte plus haut (EF-6.4, EF-6.5) | PASSED | — |
| TC-LEM-27 | REQ-LEM-07 | nominal | BDD | `frontend/src/games/lemur/features/plateforme.feature` › Le score d'une partie terminée est envoyé une fois | PASSED | — |
| TC-LEM-28 | REQ-LEM-07 | nominal | unitaire (Spy) | `frontend/src/games/lemur/application/finish.test.ts` › envoie le score une seule fois, avec la hauteur, la vanille, la cause et la durée (EF-8.1) | PASSED | — |
| TC-LEM-29 | REQ-LEM-07 | erreur | BDD | `frontend/src/games/lemur/features/plateforme.feature` › Un invité joue sans être classé | PASSED | — |
| TC-LEM-30 | REQ-LEM-07 | erreur | BDD (panne simulée, Fake) | `frontend/src/games/lemur/features/plateforme.feature` › Une coupure réseau n'empêche pas de rejouer | PASSED | — |
| TC-LEM-31 | REQ-LEM-07 | erreur | unitaire (Stub) | `frontend/src/games/lemur/application/finish.test.ts` › $cas : affiche le message au joueur sans rejeter, pour qu’il puisse rejouer (EF-8.5) | PASSED | — |
| TC-LEM-32 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/lemur.spec.ts` › aucune violation d’accessibilité WCAG 2.1 AA sérieuse ou critique sur la page du jeu | PASSED | — |
| TC-LEM-33 | REQ-LEM-08 | nominal | BDD | `frontend/src/games/lemur/features/debut.feature` › Une partie commence au pied du baobab | PASSED | — |
| TC-LEM-34 | REQ-LEM-08 | nominal | BDD | `frontend/src/games/lemur/features/debut.feature` › Le maki rebondit tout de suite sur sa première branche | PASSED | — |
| TC-LEM-35 | REQ-LEM-08 | nominal | unitaire (BVA) | `frontend/src/games/lemur/controls.test.ts` › $touche → $commande | PASSED | — |
| TC-LEM-36 | REQ-LEM-08 | nominal | composant (faux minuteurs) | `frontend/src/games/lemur/LemurGame.test.tsx` › Jouer lance une partie à 0 m, et le maki grimpe tout seul de branche en branche (EF-7.2) | PASSED | — |
| TC-LEM-37 | REQ-LEM-08 | nominal | composant (faux minuteurs) | `frontend/src/games/lemur/LemurGame.test.tsx` › Échap met la partie en pause et la fige, P la reprend (EF-7.3, EF-7.5) | PASSED | — |
| TC-LEM-38 | REQ-LEM-08 | erreur | composant | `frontend/src/games/lemur/LemurGame.test.tsx` › se met en pause tout seul quand l’onglet est masqué (EF-7.6) | PASSED | — |
| TC-LEM-39 | REQ-LEM-08 | erreur | composant (faux minuteurs) | `frontend/src/games/lemur/LemurGame.test.tsx` › quand la fossa attrape le maki, l’écran de fin donne la cause, le score et invite l’invité à se connecter (EF-7.7, EF-8.3) | PASSED | — |
| TC-LEM-40 | REQ-LEM-08 | nominal | unitaire (Fake du canvas) | `frontend/src/games/lemur/render.test.ts` › place une branche à l’écran selon la caméra : axe y du monde vers le haut, de l’écran vers le bas | PASSED | — |
| TC-LEM-41 | REQ-LEM-08 | nominal | E2E (3 navigateurs, page.clock) | `frontend/e2e/lemur.spec.ts` › une partie complète : le maki rebondit, la fossa l’attrape, puis Rejouer relance à 0 m | PASSED | — |
| TC-GTA-01 | REQ-GTA-01 | nominal | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/ville.feature` › Deux joueurs reçoivent la même ville | PASSED | — |
| TC-GTA-02 | REQ-GTA-01 | nominal | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/ville.feature` › Le GPS mène exactement à la destination | PASSED | — |
| TC-GTA-03 | REQ-GTA-01 | erreur | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/ville.feature` › Le GPS refuse une destination illisible | PASSED | — |
| TC-GTA-04 | REQ-GTA-02 | nominal | BDD front | `frontend/src/games/mini-gta/features/nouvelle-partie.feature` › Une nouvelle partie commence avec 500 $, sans armure et les poings en main | PASSED | — |
| TC-GTA-05 | REQ-GTA-02 | erreur | BDD front (plan, 4 défauts) | `frontend/src/games/mini-gta/features/nouvelle-partie.feature` › Une sauvegarde corrompue ou d'une autre version donne une nouvelle partie | PASSED | — |
| TC-GTA-06 | REQ-GTA-02 | erreur | propriété (fuzzing) | `frontend/src/games/mini-gta/domain/save.property.test.ts` › fuzzing : n’importe quelle donnée stockée est acceptée ou refusée, jamais une exception | PASSED | — |
| TC-GTA-07 | REQ-GTA-02 | nominal | E2E (3 navigateurs) | `frontend/e2e/mini-gta.spec.ts` › une sauvegarde invitée est reprise : argent, gains, missions et « Continuer » | PASSED | — |
| TC-GTA-08 | REQ-GTA-02 | erreur | E2E (3 navigateurs) | `frontend/e2e/mini-gta.spec.ts` › une sauvegarde corrompue donne une nouvelle partie au lieu d’une erreur | PASSED | — |
| TC-GTA-09 | REQ-GTA-03 | nominal | BDD back (plan, 4 missions) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/missions.feature` › Chaque mission paie sa récompense | PASSED | — |
| TC-GTA-10 | REQ-GTA-03 | erreur | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/missions.feature` › Une mission déjà terminée ne paie plus rien | PASSED | — |
| TC-GTA-11 | REQ-GTA-03 | erreur | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/missions.feature` › Une mission qui n'existe pas n'est jamais payée | PASSED | — |
| TC-GTA-12 | REQ-GTA-03 | nominal | propriété (fuzzing déterministe) | `backend/src/test/java/fr/tikigaming/games/mini_gta/progress/TransactionsPropertyTest.java` › uneMissionPaieUneSeuleFoisEtLeScoreMonteDeSaRecompense | PASSED | — |
| TC-GTA-13 | REQ-GTA-04 | nominal | BDD front | `frontend/src/games/mini-gta/features/billets.feature` › Les billets ramassés s'ajoutent à l'argent et au score | PASSED | — |
| TC-GTA-14 | REQ-GTA-04 | erreur | simulation (harnais) | `frontend/src/games/mini-gta/systems/Pickups.test.ts` › des billets ne se ramassent qu’une fois | PASSED | — |
| TC-GTA-15 | REQ-GTA-05 | nominal | BDD back (plan, 6 armes) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/armurerie.feature` › Chaque arme a son prix | PASSED | — |
| TC-GTA-16 | REQ-GTA-05 | nominal | BDD back (plan, 5 lots) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/armurerie.feature` › Les munitions se vendent par lots | PASSED | — |
| TC-GTA-17 | REQ-GTA-05 | erreur | BDD back (BVA 0/299/300/301) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/armurerie.feature` › Un achat sans les fonds est refusé, sans débit | PASSED | — |
| TC-GTA-18 | REQ-GTA-05 | erreur | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/armurerie.feature` › L'armurerie ne vend ni les poings ni de munitions pour une arme blanche | PASSED | — |
| TC-GTA-19 | REQ-GTA-05 | nominal | propriété (fuzzing déterministe) | `backend/src/test/java/fr/tikigaming/games/mini_gta/progress/TransactionsPropertyTest.java` › unAchatNePasseQueSiLeSoldeCouvreLePrixEtNeToucheJamaisAuScore | PASSED | — |
| TC-GTA-20 | REQ-GTA-05 | nominal | unitaire (doublure Fake) | `frontend/src/games/mini-gta/game/testing/fakeApi.test.ts` › le gilet est débité sans que le serveur ne touche à l’armure | PASSED | BUG-08 |
| TC-GTA-21 | REQ-GTA-06 | nominal | BDD front (plan, 8 cas) | `frontend/src/games/mini-gta/features/recherche.feature` › Les crimes vus par un témoin font monter le niveau de recherche | PASSED | — |
| TC-GTA-22 | REQ-GTA-06 | erreur | BDD front | `frontend/src/games/mini-gta/features/recherche.feature` › Un crime sans témoin ne compte pas | PASSED | — |
| TC-GTA-23 | REQ-GTA-06 | nominal | BDD front (BVA 17/18 s, 23/24 s) | `frontend/src/games/mini-gta/features/recherche.feature` › Hors de vue de la police, le niveau finit par retomber | PASSED | — |
| TC-GTA-24 | REQ-GTA-06 | erreur | propriété (fast-check) | `frontend/src/games/mini-gta/systems/Wanted.property.test.ts` › quels que soient les crimes, le niveau reste entre 0 et 5 étoiles et ne baisse jamais sur un crime | PASSED | — |
| TC-GTA-25 | REQ-GTA-07 | nominal | BDD back (BVA 994/995/1004/1005) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/reapparition.feature` › Les frais d'hôpital sont de 10 % de l'argent, 100 $ minimum | PASSED | — |
| TC-GTA-26 | REQ-GTA-07 | nominal | BDD back (BVA 1336/1337) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/reapparition.feature` › La caution est de 15 % de l'argent, 200 $ minimum | PASSED | — |
| TC-GTA-27 | REQ-GTA-07 | erreur | propriété (fuzzing déterministe) | `backend/src/test/java/fr/tikigaming/games/mini_gta/progress/TransactionsPropertyTest.java` › uneReapparitionCouteAuMoinsLeMinimumSansJamaisLaisserDeDette | PASSED | — |
| TC-GTA-28 | REQ-GTA-07 | nominal | BDD front (harnais) | `frontend/src/games/mini-gta/features/arrestation.feature` › Arrêté, il perd ses armes sauf les poings et sort du commissariat | PASSED | — |
| TC-GTA-29 | REQ-GTA-08 | nominal | BDD front (plan, 7 cas) | `frontend/src/games/mini-gta/features/score.feature` › Le score envoyé est l'argent gagné, seulement s'il bat le dernier envoyé | PASSED | — |
| TC-GTA-30 | REQ-GTA-08 | erreur | BDD front | `frontend/src/games/mini-gta/features/score.feature` › Un invité garde sa sauvegarde mais n'envoie aucun score | PASSED | — |
| TC-GTA-31 | REQ-GTA-08 | nominal | BDD back (API réelle) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/score.feature` › Les dépenses ne font pas baisser le score | PASSED | — |
| TC-GTA-32 | REQ-GTA-08 | erreur | intégration (Testcontainers) | `frontend/tests/integration/mini-gta.test.ts` › refuse 1 000 001 $ gagnés (> plafond), même pour le backend | PASSED | — |
| TC-GTA-33 | REQ-GTA-08 | nominal | intégration (Testcontainers) | `frontend/tests/integration/mini-gta.test.ts` › le classement garde la meilleure partie de chaque joueur | PASSED | — |
| TC-GTA-34 | REQ-GTA-09 | nominal | BDD back (ville générée) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/tremplins-et-batiments.feature` › La ville a des tremplins de chaque matière | PASSED | — |
| TC-GTA-35 | REQ-GTA-09 | erreur | BDD back (ville générée) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/tremplins-et-batiments.feature` › Les tremplins restent hors du trafic | PASSED | — |
| TC-GTA-36 | REQ-GTA-10 | nominal | BDD back (ville générée) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/tremplins-et-batiments.feature` › Environ un bâtiment ordinaire sur cinq est ouvert | PASSED | — |
| TC-GTA-37 | REQ-GTA-10 | erreur | BDD back (ville générée) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/tremplins-et-batiments.feature` › Seul le rez-de-chaussée d'un bâtiment ouvert est accessible | PASSED | — |
| TC-GTA-38 | REQ-GTA-11 | nominal | E2E (3 navigateurs) | `frontend/e2e/mini-gta.spec.ts` › un invité sans sauvegarde peut lancer une nouvelle partie et est invité à se connecter | PASSED | — |
| TC-GTA-39 | REQ-GTA-11 | erreur | E2E (3 navigateurs, 340 px) | `frontend/e2e/mini-gta.spec.ts` › sous 360 px, le jeu explique qu’il se joue sur ordinateur au lieu de proposer « Jouer » | PASSED | — |
| TC-GTA-40 | REQ-ERR-01 | erreur | E2E (3 navigateurs) | `frontend/e2e/mini-gta.spec.ts` › classement indisponible : un message lisible, et la partie reste jouable | PASSED | — |
| TC-GTA-41 | REQ-A11Y-01 | nominal | E2E + axe-core | `frontend/e2e/mini-gta.spec.ts` › aucune violation d’accessibilité sérieuse sur l’accueil | PASSED | — |
| TC-GTA-42 | REQ-API-01 | nominal | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › une mission réussie est payée et renvoie la progression à sauvegarder | PASSED | — |
| TC-GTA-43 | REQ-API-01 | erreur | contrat (Pact, consumer) | `frontend/tests/contract/backend.pact.test.ts` › une progression invalide est refusée (400) | PASSED | — |
| TC-GTA-44 | REQ-SEC-01 | erreur | système (@SpringBootTest) | `backend/src/test/java/fr/tikigaming/games/mini_gta/api/MiniGtaJourneyTest.java` › unPostSansJetonCsrfEstRefuse | PASSED | — |
| TC-GTA-45 | REQ-GTA-08 | erreur | BDD back (plan, BVA 996 999 / 997 000 / 997 001 / 1 000 000) | `backend/src/test/resources/fr/tikigaming/games/mini_gta/features/score.feature` › Le score s'arrête à 1 000 000, l'argent gagné reste au joueur | PASSED | BUG-12 |
| TC-GTA-46 | REQ-GTA-08 | erreur | unitaire (BVA) | `backend/src/test/java/fr/tikigaming/games/mini_gta/progress/TransactionsTest.java` › lesGainsCumulesSArretentAuPlafondDuScore | PASSED | BUG-12 |
| TC-GTA-47 | REQ-GTA-07 | erreur | propriété (fuzzing déterministe, jusqu'à Integer.MAX_VALUE) | `backend/src/test/java/fr/tikigaming/games/mini_gta/progress/TransactionsPropertyTest.java` › uneRecompenseNeFaitJamaisBaisserNiLeSoldeNiLeScoreMemeAuxBornesDesEntiers | PASSED | BUG-13 |
| TC-GTA-48 | REQ-GTA-08 | erreur | unitaire (doublure Fake) | `frontend/src/games/mini-gta/game/testing/fakeApi.test.ts` › fakeApi : mêmes règles de mission que le serveur | PASSED | BUG-12 |
| TC-GTA-49 | REQ-GTA-02 | nominal | unitaire | `frontend/src/games/mini-gta/systems/weapons.test.ts` › starts with fists only, as a new game (R2) | PASSED | BUG-09 |

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
| BUG-06 | [Rush Hour][Vérification d'une partie] à 200 vérifications par seconde du niveau 20, P95 de 2,7 s et 2 059 itérations abandonnées au lieu de P95 < 300 ms (solveur relancé à chaque requête, même pour une partie truquée) | S2 | P2 | Closed | 214b828f et 54bc0adc, test 959b77ef, trouvé par k6 (profil stress) |
| BUG-07 | [MiniGTA][Refus de l'API] le joueur lit « Requête invalide. » au lieu du message du contrôleur (« Mission inconnue. », « Coordonnées invalides. », « Cet article n'est pas vendu. ») | S3 | P3 | New | — (ApiExceptionHandler, plateforme ; trouvé par les scénarios BDD) |
| BUG-08 | [MiniGTA][Fake du serveur] l'achat d'une arme donne un lot de munitions (36 au pistolet) au lieu de deux chargeurs (24), et le gilet remet l'armure à 100 au lieu de seulement débiter | S2 | P2 | Closed | 658e855b, test rouge acfabdb2 |
| BUG-09 | [MiniGTA][Nouvelle partie] le joueur démarre avec un pistolet (12 + 48 balles) au lieu des seuls poings (R2) | S3 | P2 | Closed | 736be2f5, tests rouges 4e090112 (BDD) et 2bce07b7 (unitaire) ; la règle R2 écrite fait foi |
| BUG-10 | [MiniGTA][Tests de simulation] 17 tests échouent dès que l'ordre d'exécution est mélangé au lieu de passer dans tout ordre (état partagé entre tests) | S2 | P1 | Closed | 1abf9b0f, trouvé par `vitest --sequence.shuffle` |
| BUG-11 | [MiniGTA][Trafic en pente] une voiture du trafic sur une route en pente part en position NaN au lieu de suivre la route (copie d'un Quaternion par décomposition) | S1 | P1 | Closed | 981e04d1, test rouge 25444da6, trouvé en isolant les tests de simulation |
| BUG-12 | [MiniGTA][Mission réussie] le serveur renvoie plus de 1 000 000 $ de gains cumulés au lieu de s'arrêter au plafond du score (R8) | S2 | P2 | Closed | 1ceeb6a6, tests rouges ecca4a81 (BDD) et 526470f6 (unitaire) |
| BUG-13 | [MiniGTA][Mission réussie] un solde proche de Integer.MAX_VALUE déborde en négatif au lieu de rester positif (R7) | S2 | P2 | Closed | 58819f54, test rouge a0c2470f (propriété) |
