# Yams : matrice de traçabilité des exigences (RTM)

La matrice relie chaque exigence du Yams aux tests qui la vérifient, et se lit dans les deux sens :

- **aval** (exigence → tests) : chaque exigence a au moins un cas **nominal** et un cas **d'erreur** ;
- **amont** (test → exigence) : chaque cas de test se rattache à une exigence.

Elle reprend le format de la matrice de la plateforme (`specs/rtm-matrix.md`), sans la modifier. **Statut** :
`PASSED`, `FAILED` ou `BLOCKED`, celui de la dernière exécution. **Preuve** : `` `fichier` › titre `` (titre du test
Vitest ou Playwright, ou du scénario Gherkin).

## Exigences

| Exigence | Besoin | Source |
|----------|--------|--------|
| REQ-YAMS-01 | Chaque combinaison rapporte les points prévus par les règles (brelan, carré, full 25, petite suite 30, grande suite 40, Yams 50, chance), et 0 si les dés ne la forment pas | Règles du Yams (issue #4), atelier Trois Amigos |
| REQ-YAMS-02 | Le bonus de 35 points est accordé à partir de 63 points en section haute, jamais en dessous | Règles du Yams (issue #4) |
| REQ-YAMS-03 | Un tour compte au plus 3 lancers, et seuls les dés non gardés sont relancés | Règles du Yams (issue #4) |
| REQ-YAMS-04 | Chaque case ne se joue qu'une fois ; après chaque case, la main passe à l'autre joueur | Règles du Yams, partie à 2 joueurs sur le même écran |
| REQ-YAMS-05 | Le score du joueur 1 est envoyé une seule fois, quand les deux feuilles sont pleines ; un invité n'envoie aucun score | Classement de la plateforme (anti-triche) |
| REQ-YAMS-06 | La base refuse un score au-dessus du maximum du Yams (375), sans perdre la partie sauvegardée | Classement de la plateforme (score maximum déclaré par le jeu) |

## Cas de test

| Cas | Exigence | Nature | Niveau | Preuve | Statut | Anomalie |
|-----|----------|--------|--------|--------|--------|----------|
| TC-YAMS-01 | REQ-YAMS-01 | nominal | unitaire (TDD) | `frontend/src/games/yams/logic.test.ts` › donne 25 points pour un full, rien pour deux paires | PASSED | — |
| TC-YAMS-02 | REQ-YAMS-01 | erreur | BDD | `frontend/src/games/yams/features/feuille-de-score.feature` › Les combinaisons à la frontière des règles | PASSED | BUG-YAMS-01 |
| TC-YAMS-03 | REQ-YAMS-02 | nominal | unitaire (BVA) | `frontend/src/games/yams/logic.test.ts` › donne le bonus de 35 points à partir de 63 en section haute | PASSED | — |
| TC-YAMS-04 | REQ-YAMS-02 | erreur | BDD (BVA) | `frontend/src/games/yams/features/feuille-de-score.feature` › Le bonus de 35 points se gagne à partir de 63 en section haute | PASSED | — |
| TC-YAMS-05 | REQ-YAMS-03 | nominal | unitaire (Stub du dé) | `frontend/src/games/yams/logic.test.ts` › ne relance que les dés non conservés | PASSED | — |
| TC-YAMS-06 | REQ-YAMS-03 | erreur | unitaire | `frontend/src/games/yams/logic.test.ts` › refuse un dé inexistant et un quatrième lancer | PASSED | — |
| TC-YAMS-07 | REQ-YAMS-04 | nominal | E2E (Playwright) | `frontend/e2e/yams.spec.ts` › le joueur 1 lance, garde un dé, relance puis choisit une case : la main passe au joueur 2 | PASSED | — |
| TC-YAMS-08 | REQ-YAMS-04 | erreur | BDD | `frontend/src/games/yams/features/feuille-de-score.feature` › Une case déjà jouée ne peut pas être rejouée | PASSED | — |
| TC-YAMS-09 | REQ-YAMS-05 | nominal | unitaire (Fake) | `frontend/src/games/yams/session.test.ts` › envoie une seule fois le total du joueur 1 quand les deux feuilles sont complètes | PASSED | — |
| TC-YAMS-10 | REQ-YAMS-05 | erreur | unitaire (Fake) | `frontend/src/games/yams/session.test.ts` › n’enregistre aucun score en invité | PASSED | — |
| TC-YAMS-11 | REQ-YAMS-06 | nominal | intégration (Testcontainers) | `frontend/tests/integration/yams.test.ts` › score accepté (375, le plafond) : la sauvegarde est effacée et le score enregistré | FAILED | BUG-YAMS-02 |
| TC-YAMS-12 | REQ-YAMS-06 | erreur | intégration (Testcontainers) | `frontend/tests/integration/yams.test.ts` › score refusé (376, au-dessus du plafond) : rien n’est écrit, la sauvegarde effacée revient | PASSED | — |

TC-YAMS-11 est `PASSED` sur la branche, mais `FAILED` quand on le rejoue sur la dernière version de `dev` (04/11/2026) :
c'est la dernière exécution qui compte, d'où l'anomalie BUG-YAMS-02.

## Anomalies

Titre au format `[Module][Action] observé au lieu de attendu`. Sévérité : S0 bloquante → S3 cosmétique ; priorité :
P0 immédiate → P3 basse. Statut : cycle de vie ISTQB (New → Assigned → Open → Fixed → Retest → Closed).

| Anomalie | Titre | Sévérité | Priorité | Statut | Correctif |
|----------|-------|----------|----------|--------|-----------|
| BUG-YAMS-01 | [Feuille de score][Tests BDD en ordre aléatoire] une étape « Alors » s'exécute avant son « Quand » au lieu de suivre l'ordre du scénario | S2 | P1 | Closed | 474250e0, trouvé par le test anti-flaky (`--sequence.shuffle`) |
| BUG-YAMS-02 | [Fin de partie][Score de 375] l'enregistrement est refusé (« permission denied for table scores ») au lieu d'être accepté, sur `dev` depuis la migration `scores_server_only` | S2 | P1 | Open | — |

## Scénarios détaillés

Préconditions, données et étapes de chaque cas, pour qu'il soit reproductible à la main comme en automatique.

| Cas | Préconditions | Jeu de données | Étapes | Résultat attendu |
|-----|---------------|----------------|--------|------------------|
| TC-YAMS-01 | Feuille vierge | Dés 3-3-3-6-6, puis 3-3-6-6-1 | 1. Calculer la case Full pour chaque lancer | 25 points, puis 0 |
| TC-YAMS-02 | Feuille vierge | 8 lancers à la frontière (ex. 4-4-4-4-4 en Full, 2-2-2-2-2 en Carré, 1-2-3-5-6 en Petite suite) | 1. Inscrire chaque lancer dans sa case | Les points du tableau Exemples (ex. Yams en Full : 0 ; Yams en Carré : 10) |
| TC-YAMS-03 | Section haute à 60 points | As à 3 | 1. Ajouter l'As · 2. Calculer le bonus | Sous-total 63 : bonus de 35 |
| TC-YAMS-04 | Section haute remplie | Sous-totaux 62, 63, 64 | 1. Calculer le bonus pour chaque sous-total | 62 : 0 ; 63 et 64 : 35 |
| TC-YAMS-05 | Tour en cours, 1 lancer fait, dés 3-1-4-1-5 | Dés 1 et 2 gardés, faux dé qui donne toujours 6 | 1. Relancer | Dés 3-1-6-6-6, 2 lancers utilisés |
| TC-YAMS-06 | Tour en cours | Dé n° 5 ; tour à 3 lancers | 1. Garder le dé n° 5 · 2. Lancer une 4e fois | « Dé inexistant », puis « Plus de lancer disponible » |
| TC-YAMS-07 | Jeu ouvert dans Chromium, serveur simulé, dés fixés | Tous les dés à 4 | 1. Lancer · 2. Garder le dé 1 · 3. Relancer · 4. Choisir la case Yams (50) | Le joueur 2 a la main |
| TC-YAMS-08 | La case Yams vaut déjà 50 points | Dés 6-6-6-6-6 | 1. Inscrire dans la case Yams | Refus : « Case déjà jouée » |
| TC-YAMS-09 | Joueur connecté, deux feuilles complètes | Joueur 1 : 65 points ; joueur 2 : 78 points | 1. Terminer la partie | Un seul envoi au classement, de 65 points |
| TC-YAMS-10 | Invité (non connecté), deux feuilles complètes | Joueur 1 : 65 points | 1. Terminer la partie | Aucun score enregistré |
| TC-YAMS-11 | Base PostgreSQL réelle, partie sauvegardée | Score de 375 | 1. Terminer la partie | Score enregistré, sauvegarde effacée |
| TC-YAMS-12 | Base PostgreSQL réelle, partie sauvegardée | Score de 376 | 1. Terminer la partie | Refus de la base ; rien n'est écrit et la sauvegarde revient |
## Rapports d'anomalie

### BUG-YAMS-01 · Étapes BDD mélangées en ordre aléatoire

| Rubrique | Contenu |
|----------|---------|
| Titre | [Feuille de score][Tests BDD en ordre aléatoire] une étape « Alors » s'exécute avant son « Quand » au lieu de suivre l'ordre du scénario |
| Cas de test | TC-YAMS-02 (et tous les scénarios de `feuille-de-score.feature`) |
| Reproduction | 1. Se placer sur le commit `eac280f5` · 2. Depuis `frontend/`, lancer `npx vitest run src/games/yams --sequence.shuffle` plusieurs fois avec des graines différentes · 3. Selon la graine, des étapes d'un scénario s'exécutent dans le désordre et le scénario échoue |
| Attendu | Les étapes d'un scénario s'exécutent dans l'ordre Étant donné → Quand → Alors, quel que soit l'ordre des fichiers et des tests |
| Cause | Le mélange aléatoire de Vitest s'appliquait aussi aux étapes d'un même scénario, qui partagent un état (feuille, dés) |
| Sévérité · Priorité | S2 (aucun impact joueur, mais la CI peut échouer au hasard) · P1 (à corriger dans le sprint : un test instable fait perdre confiance dans toute la suite) |
| Correctif | `474250e0` : les scénarios restent mélangés entre eux, mais les étapes d'un scénario gardent leur ordre (`shuffle: false` sur le bloc BDD) |
| Re-test | 100 exécutions avec `--sequence.shuffle --sequence.seed=1` à `100` : 100 sur 100 vertes (81 tests à chaque fois) |
| Cycle de vie | New → Open → Fixed (`474250e0`) → Retest (100 / 100) → **Closed** |

### BUG-YAMS-02 · Score de 375 refusé sur `dev`

| Rubrique | Contenu |
|----------|---------|
| Titre | [Fin de partie][Score de 375] l'enregistrement est refusé (« permission denied for table scores ») au lieu d'être accepté, sur `dev` depuis la migration `scores_server_only` |
| Cas de test | TC-YAMS-11 |
| Reproduction | 1. Fusionner `dev` dans la branche (ou se placer sur `dev`) · 2. Démarrer Docker · 3. Depuis `frontend/`, lancer `npm run test:integration -- tests/integration/yams.test.ts` |
| Attendu | Le score de 375 est enregistré et la sauvegarde est effacée |
| Observé | `error: permission denied for table scores` à la ligne 51 de `yams.test.ts` ; 1 test en échec sur 5 (exécution du 04/11/2026) |
| Cause | La migration `20261104120000_scores_server_only` de `dev` réserve l'écriture des scores au backend (`service_role`). Le test écrit encore le score en tant que joueur connecté (`as(db, alice, …)`) |
| Sévérité · Priorité | S2 (le jeu n'est pas touché : c'est le test qui suit l'ancienne règle) · P1 (la CI de la PR sera rouge tant qu'il n'est pas adapté) |
| Correctif prévu | Écrire le score comme le backend (`asServer`, avec `user_id`), et attendre le code `23514` au-dessus du plafond, comme `sudoku.test.ts` |
| Cycle de vie | New → **Open** (à corriger, puis Retest et Closed) |
