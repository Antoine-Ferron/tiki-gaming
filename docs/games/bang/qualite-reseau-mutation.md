# Qualité BANG! — reprise réseau et mutations

Travail d'Antoine, limité à #54–#60 et aux commandes du joueur et à la démo de #61. Les cartes, rôles, personnages et leurs règles de Colleen restent inchangés. Le moteur de production n'a pas nécessité de correctif : les changements portent sur les tests et leur configuration.

## Traçabilité

| Issue | Comportements | Preuves rapides et parcours |
| --- | --- | --- |
| #54 | Créer, rejoindre, capacité, retrouver son siège | `PrivateTableServiceTest`, `PrivateTablesHttpTest`, `BangTurnRecoveryNetworkTest` |
| #55 | Distribution, PV, cartes physiques, premier tour, démarrage répété | `InitialDealTest`, `GameStartServiceTest`, `GameStartWiringHttpTest`, `partie-locale.steps.test.ts` |
| #56 | Main et rôle du compte uniquement, informations publiques, refus d'un tiers | `GameViewServiceTest`, `GameViewHttpTest`, `LocalTable.test.tsx`, parcours à quatre `bang.spec.ts` |
| #57 | Pioche unique, phases, refus d'un renvoi, limite de main, passage au siège suivant | `CardDrawTest`, `GameTurnServiceTest`, `GameTurnHttpTest`, `GameTurnActivityHttpTest`, `BangTurnRecoveryNetworkTest`, `local.test.ts`, `tour.steps.test.ts` |
| #58 | Trajet circulaire, vivants seulement, refus hors portée | `PlayerDistanceTest`, `ShotDistanceRulesTest`, `GameShotServiceTest.aShotOutsideTheTableRangeIsRefusedWithoutChangingAnyPlayersView`, `local.test.ts` |
| #59 | Tir en attente, réponse de la seule cible, reconnexion, réponse répétée | `ShotRulesTest`, `GameShotServiceTest.onlyTheTargetCanRespondAndARepeatedResponseCannotDiscardTwice`, `GameShotHttpTest`, `OnlineTable.test.tsx`, `tir.steps.test.ts` |
| #60 | Tapis publics, main privée, commandes et mise à jour du plateau | `plateau.steps.test.ts`, `OnlineTable.test.tsx`, `LocalTable.test.tsx` |
| #61 (Antoine) | Démo locale/en ligne, clic valide conservé, fin de tour envoyée une fois | `OnlineTable.test.tsx`, `BangGame.test.tsx`, les neuf tests de `e2e-real/` sélectionnés par `playwright.bang-real.config.ts` |

Les tests de service doublent le collaborateur `InitialDeal` avec Mockito et vérifient le résultat public de la commande. Les tests de composant doublent la frontière HTTP avec des promesses contrôlées et observent les commandes envoyées et le plateau accessible. Chaque comportement ajouté est vérifié séparément avant de passer au suivant.

## Réponse perdue : Spring et Docker réels

`BangTurnRecoveryNetworkTest` démarre Spring sur un port aléatoire. Seul le fournisseur d'identité distant est doublé : les quatre connexions passent par `AuthController`, possèdent quatre `JSESSIONID` différents et utilisent le vrai cookie et le vrai filtre CSRF. Un POST sans jeton reçoit effectivement 403. La donne utilise les contrats et le catalogue de production avec un mélange contrôlé ; aucune base de données ne remplace le moteur en mémoire.

Le proxy réutilise `ghcr.io/shopify/toxiproxy:2.12.0` et les dépendances Testcontainers du backend. Un toxic `timeout` de direction `DOWNSTREAM` et de durée zéro retient tous les octets de la réponse, en laissant la requête atteindre Spring. Une deuxième connexion HTTP, celle du siège 2, observe `DISCARD`, le siège actif 1 et ses sept cartes. Le futur du premier POST est encore incomplet à cet instant. Le test coupe alors cette connexion, vérifie son échec réseau, retire le toxic et rétablit le proxy.

La session initiale retrouve le siège 1 et les sept mêmes cartes. Le renvoi de la fin de tour reçoit 409 ; les quatre vues sont strictement identiques avant et après ce refus. Deux défausses ramènent la main à cinq cartes ; une nouvelle fin de tour donne le siège 2 en phase `DRAW` dans les quatre vues. L'ordre est commandé par les réponses HTTP, l'observation de la phase avec Awaitility et la complétion du futur, sans `Thread.sleep`.

## Campagnes séparées

Le profil Maven `mutation` conserve toutes les cibles des autres équipes et ajoute les cinq classes demandées et leurs classes internes. Les tests Spring `*HttpTest`, le test d'isolation du serveur navigateur et `*NetworkTest` de BANG! sont exclus de PIT. Le test réseau reste exécuté par Surefire, donc par `mvn clean verify`.

`stryker.config.mjs` conserve les cibles communes et ajoute `OnlineTable.tsx` et `local.ts`. `stryker.bang.config.mjs` reprend les mêmes paramètres et le seuil de 75 %, mais limite la mesure aux deux fichiers BANG!. Son Vitest inclut seulement `src/games/bang/**/*.test.{ts,tsx}` ; Docker et Playwright restent hors de cette boucle. Aucun mutant n'est désactivé pour améliorer le score.

Commandes PowerShell depuis `backend/` :

```powershell
mvn -B -ntp -Dtest=BangTurnRecoveryNetworkTest test
mvn -B -ntp -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage '-DtargetClasses=fr.tikigaming.games.bang.engine.PrivateTableService*,fr.tikigaming.games.bang.engine.InitialDeal,fr.tikigaming.games.bang.engine.CardDraw,fr.tikigaming.games.bang.engine.PlayerDistance,fr.tikigaming.games.bang.engine.ShotRules*' '-DtargetTests=fr.tikigaming.games.bang.engine.*Test' '-DreportsDirectory=../quality/reports/bang/pit-after' '-Dthreads=4'
mvn -B -ntp clean verify
```

Depuis `frontend/` :

```powershell
npx stryker run stryker.bang.config.mjs
npm run test:coverage -- --maxWorkers=4
npm run lint
npm run build
npm run format:check -- --end-of-line auto
npm run test:e2e:bang
```

La première commande PIT utilisait `pit-before` comme répertoire de rapport ; les arguments et le seuil étaient identiques. Les rapports Stryker initiaux sont conservés avant le second lancement dans `quality/reports/bang/stryker-before/`. L'option Prettier `--end-of-line auto` respecte les fins de ligne du checkout Windows : le contrôle sans cette option signale 67 fichiers, majoritairement arrivés de `dev`, sans anomalie de style avec cette option. Aucune remise en forme de ces autres jeux n'est livrée.

## Preuves rouge / vert

Les mutations ci-dessous ont été appliquées temporairement, un comportement à la fois, puis retirées. Le code de production livré est identique à celui du point de départ intégré.

| Comportement ajouté | Mutant reproduit | Rouge observable | Preuve locale |
| --- | --- | --- | --- |
| Tir via le service à distance 2 | Le collaborateur de `ShotRules` renvoie toujours la distance zéro | Le refus 409 attendu ne se produit plus | `range-mutant-red.log` / `range-normal-green.log` |
| Renvoi d'une fin pendant `DISCARD` | Suppression du refus de répétition | La commande ne lève plus le conflit attendu | `end-retry-mutant-red.log` / `end-retry-normal-green.log` |
| Réponse réservée à la cible | Suppression du contrôle du compte cible | Un autre joueur peut répondre sans refus | `shot-response-mutant-red.log` / `shot-response-normal-green.log` |
| Une seule fin pendant un POST lent et une lecture `PLAY` | Suppression de la distinction entre commande courante et commande retenue | Deux POST `/turn/end` au lieu d'un | `double-end-mutant-red.log` / `double-end-normal-green.log` |
| Deux clics de défausse valides | Identifiant de commande de défausse remplacé par la chaîne vide | Seule `carte-0` part, le clic sur `carte-1` est perdu | `valid-click-mutant-red.log` / `valid-click-normal-green.log` |
| Portée circulaire depuis d'autres sièges que le premier | Addition des indices au lieu de leur différence | Le tir 2 → 4 est accepté hors portée | `local-range-mutant-red.log` / `local-range-normal-green.log` |
| Défausse de la carte sélectionnée | Conservation de toute la main au lieu de son filtrage | La carte choisie reste dans la main | `discard-mutant-red.log` / `discard-normal-green.log` |

Ces journaux sont dans `quality/reports/bang/`. Ils contiennent des échecs de l'assertion métier attendue, puis un passage des tests sur le code normal, pas une erreur de compilation.

La confidentialité était déjà protégée par les tests existants : les mutants Stryker du choix de la main par siège (327–330 dans le rapport initial) et de publication des rôles (338–343) sont tués. Le contrat Java de `GameViewServiceTest` compare toute la projection privée, notamment les identifiants des cartes, les rôles masqués et les champs publics. Aucun assouplissement des contrats de Colleen n'a été introduit.

## Résultats et remise

Les sources, tests et configurations validés sont figés au SHA `61c6737de1c0077c465e099550c8e6f471531de2`. Le dernier commit de remise ne contient que cette documentation et l'inventaire des mutants. La référence initiale est l'intégration `f867f321a69d7aa19ef8a54cd590ac20c60206c6`, avant les nouveaux tests ; l'ajout des cibles BANG! était nécessaire à la première mesure. Les mêmes 216 mutants Java et 537 mutants TypeScript ont été mesurés avant et après, sans historique incrémental.

| Outil | Mesure | Score | Tués | Timeout | Survivants | Non couverts | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PIT | Avant | 80,56 % | 173 | 1 | 28 | 14 | 216 |
| PIT | Après | 87,04 % | 186 | 2 | 27 | 1 | 216 |
| Stryker | Avant | 85,29 % | 453 | 5 | 68 | 11 | 537 |
| Stryker | Après | 86,59 % | 460 | 5 | 61 | 11 | 537 |

Le score publié par les deux outils compte les mutants tués **et les timeouts** comme détectés. Les colonnes les séparent pour ne pas assimiler un timeout à un échec d'assertion. Les seuils de 75 % sont conservés et passent. Les derniers rejeux PIT et Stryker ont respectivement terminé le 5 novembre à 16 h 40 et à 16 h 41 (Europe/Paris).

Un exemple précis d'erreur auparavant invisible : le mutant Stryker 543 efface l'identifiant d'une commande de défausse. Un premier POST lent et une vue serveur à jour rendent alors le clic valide sur la carte suivante indiscernable du précédent. La suite initiale laissait survivre ce mutant ; le nouveau test exige les deux POST, dans l'ordre, sur `carte-0` puis `carte-1`. Il est rouge avec le mutant, vert normalement, et ce mutant est désormais `Killed`. Les mutants 432, 433, 434 et 438 de la garde de commandes sont également passés de `Survived` à `Killed` ; les mutants de portée locale 243 et 246 le sont aussi.

L'[inventaire complet des mutants restants](mutations-restantes.md) distingue les survivants, non couverts et timeouts. Ce travail mesure et renforce des comportements ; il ne constitue pas une preuve que toutes les erreurs possibles sont détectées. Les refus encore couverts seulement par HTTP restent une limite de la campagne Java rapide. Les timeouts de défausse subsistent dans Stryker, malgré la preuve rouge immédiate du test direct, parce qu'un autre test couvrant est exécuté en premier.

| Vérification finale | Résultat | Preuve locale |
| --- | --- | --- |
| Test réseau isolé | 1 passé, 0 ignoré, Toxiproxy Docker réel | `quality/reports/bang/docker-first.log` |
| Rejeu réseau dans `mvn clean verify` | 1 passé, 0 ignoré, 4,889 s | `quality/reports/bang/docker-replay/TEST-fr.tikigaming.games.bang.engine.BangTurnRecoveryNetworkTest.xml` |
| `mvn clean verify` | 7 005 tests, 0 échec, 0 ignoré ; JaCoCo, Checkstyle et Spotless verts | `quality/reports/bang/maven-clean-verify.log`, `backend/target/site/jacoco/index.html` |
| Front avec couverture | 148 fichiers, 1 928 tests verts ; seuils verts | `quality/reports/bang/frontend-coverage.log`, `frontend/coverage/index.html` |
| Lint / build / format | Verts ; un avertissement ESLint existant côté échecs | `quality/reports/bang/frontend-{lint,build,format}.log` |
| `npm run test:e2e:bang` | 9/9 sous Chromium avec Spring, 1 min 30 s | `quality/reports/bang/e2e-bang.log`, traces dans `frontend/test-results/` |

Docker Desktop utilise ici le moteur Linux Docker 29.7.2. Les identifiants de conteneurs Toxiproxy et leur démarrage figurent dans les journaux et le XML Surefire ; `docker-version.log` et `docker-image.log` enregistrent aussi la version et l'image. Les quatre sessions, le POST sans CSRF refusé et le blocage unidirectionnel sont vérifiés par le test, pas simulés par MockMvc. Le serveur de développement sur 8080, qui verrouillait initialement `target`, a été arrêté complètement avec l'accord d'Antoine avant le clean ; il n'a pas été relancé.

Rapports de mutation complets :

- PIT : `quality/reports/bang/pit-before/index.html`, `quality/reports/bang/pit-after/index.html` et leurs `mutations.xml`.
- Stryker : `quality/reports/bang/stryker-before/mutation.html`, `quality/reports/bang/stryker-after/mutation.html` et leurs `mutation.json`. La sortie courante est aussi dans `frontend/reports/mutation/bang/`.
- Comptages machine : `quality/reports/bang/scores.json` ; commandes et sorties complètes dans les fichiers `*.log` du même dossier. Ces rapports locaux générés sont ignorés par Git ; ce bilan et l'inventaire sont versionnés.

La branche locale est `af/bang-tests-reseau-mutation`. Un fetch final a été fait le 5 novembre à 16 h 40 : `origin/dev` (`cb4ae7d4542843efd07524bab731cd0afb7fbc1d`) est ancêtre de HEAD, tout comme `04fc3fa0e1ad729f504f6b797656f576e17cfeab`, dernier head de la branche commune récupéré via la PR #88. Le contrôle littéral d'`origin/game/bang/implementation` est impossible : cette branche distante a été supprimée après la fusion de #88. Aucune référence distante artificielle n'a été créée pour masquer cette absence. Après cette fusion, partir directement de `origin/dev` aurait évité la réintégration des mêmes changements ; le point de départ commun a ici été conservé conformément à la demande initiale.

Les étapes vertes sont enregistrées dans de petits commits locaux liés à #57, #58, #59 et #61. Le brouillon de sous-issue reste local, conformément au choix d'Antoine. Aucun push ni merge de livraison n'a été effectué ; la branche est remise pour sa revue.
