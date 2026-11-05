# BANG! — Recette simulée, CI et charge

Travail d'Antoine sur `af/bang-tests-reseau-mutation`. Les onze commits qualité ont été sauvegardés et rejoués sur `origin/dev` ; voir la [correspondance des SHA](correspondance-sha-qualite.md). Les preuves originales Testcontainers, PIT et Stryker ne sont pas réécrites. Le moteur, les cartes, les personnages, les rôles et leurs règles restent inchangés.

## Recette simulée à quatre

Cette exécution automatisée locale utilise Chromium et Spring réels, deux comptes de test et deux invités dans quatre contextes distincts. Le fournisseur d'identité est la fixture locale déjà utilisée par la démo ; les cookies de session et la protection CSRF sont réels. Il s'agit d'une **recette simulée**, sans validation humaine ni procès-verbal signé.

Le parcours mixte existant est conservé. Il vérifie la jonction par code, les quatre identités de session distinctes, la main et le rôle propres à chaque siège, les informations publiques communes et l'absence des cartes et rôles secrets adverses dans les JSON. Les invités retrouvent leurs sièges et leurs cartes après actualisation, un tir reçoit sa réponse, puis la dernière fin de tour passe du siège 4 au siège 1 en `DRAW`. Le scénario s'arrête là. Les invités restent sans compte ; aucun POST de score ni score en attente dans le SDK n'est constaté.

Le cas local existant contient un seul parcours partagé de comparaison, dans l'étape Playwright « même tour local et en ligne ». Il appelle `local.ts` et les vrais endpoints Spring avec la même donne : rôles conservés dans l'ordre, personnages tournés d'un cran et pioche de 37 cartes tournée de vingt positions. Ces réglages correspondent à `BangBrowserApplication` et ne modifient pas le code de production.

| Étape | Siège actif / phase attendus | Main du siège 1 | Main du siège 2 |
| --- | --- | --- | --- |
| Donne | 1 / DRAW | 5 cartes | 4 cartes |
| Piocher | 1 / PLAY | 7 cartes | 4 cartes |
| Finir la phase de jeu | 1 / DISCARD | 7 cartes | 4 cartes |
| Première défausse | 1 / DISCARD | 6 cartes | 4 cartes |
| Deuxième défausse | 1 / DISCARD | 5 cartes | 4 cartes |
| Passer la main | 2 / DRAW | 5 cartes | 4 cartes |

À chaque ligne, les identifiants et types de toutes les cartes des deux mains sont comparés, avec le siège actif et la phase. L'attachement `meme-tour-local-en-ligne` conserve les douze observations dans le rapport Playwright. Le [cahier de recette](../../../specs/cahier-de-recette.md) et la [matrice RTM](../../../specs/rtm-matrix.md) donnent les attendus, observés, SHA et traces.

## CI proposée

Le job commun `e2e` et sa commande `npm run test:e2e` restent présents. Un nouveau job `e2e-bang`, avec son propre checkout, lance `npm run test:e2e:bang` depuis `frontend/`, sous Chromium et avec Spring. Les neuf scénarios utilisent un seul worker, avec `retries: 0`. Le front est compilé puis servi par `vite preview`, avec le proxy `/api` vers Spring : il n'y a ni HMR ni compilation de module à la volée pendant les gestes. Stryker tourne dans un autre job et un autre checkout. En local, les campagnes restent exécutées séparément.

Le job suit les conditions du palier dynamique : PR prête pour revue vers `dev` concernée par le front, le backend ou `quality/`, ainsi que les déclenchements habituels du workflow. Les brouillons restent limités au palier 1 selon CONTRIBUTING. Un échec remonte au job `CI (verdict)` ; Sonar attend également ce résultat. L'artefact `rapport-e2e-bang`, publié même en cas d'échec, contient le rapport HTML, le JSON et les traces. Le dossier de sortie est `frontend/reports/bang-e2e/`, distinct des anciennes traces et des rapports Stryker.

Le job de performance conserve la charge du lobby. Il ajoute les tests des sessions BANG! puis le profil nominal et publie `rapport-k6-bang`. Les rapports BANG! sont séparés de `quality/reports/k6-summary.json`.

Le YAML, les dépendances entre jobs, le maintien de la suite commune, les artefacts et la propagation au verdict ont été vérifiés localement. **Les nouveaux jobs n'ont pas été exécutés sur GitHub** : aucune branche n'est publiée et aucune PR n'est ouverte pour cette livraison.

## Charge k6

`quality/k6/bang.js` utilise le conteneur k6 existant de `quality/docker-compose.yml`. Une VU possède une table et ses quatre vrais CookieJar isolés. Chaque session consulte sa propre vue toutes les deux secondes. Le profil rapide comporte une table pendant six secondes ; le profil nominal dix tables pendant trente secondes, soit quarante sessions et vingt lectures par seconde en moyenne.

Chaque table exécute une fois `piocher → finir → défausser deux cartes → finir`, avec les cookies et jetons CSRF émis par Spring. Le Shérif et sa limite sont lus dans les vues, sans supposer un siège ni un personnage. Les quatre vues finales doivent montrer le joueur suivant en `DRAW`, la main du Shérif attendue et les autres mains inchangées. Une table non démarrée, une commande refusée ou un effet incorrect empêchent de compter cette table comme jouée et font échouer le test.

Les lectures et les commandes ont chacune leurs seuils P95 < 300 ms, P99 < 500 ms et erreurs < 1 %. Les compteurs exigent exactement dix tables démarrées et jouées, cinquante commandes et au moins 95 % du volume prévu de lectures. Les requêtes de préparation et de vérification sont identifiées séparément et ne gonflent pas ces deux mesures.

| Nominal local | Requêtes | Débit atteint | P95 | P99 | Erreurs |
| --- | --- | --- | --- | --- | --- |
| Lectures | 600 | 19,72/s | 3,11 ms | 5,45 ms | 0 % |
| Commandes | 50 | 1,64/s | 3,27 ms | 3,43 ms | 0 % |

Dix tables démarrées, dix tours joués et vérifiés, 150 itérations, aucun abandon : seuils verts, code de sortie zéro. Le débit k6 est calculé sur la durée totale, préparation comprise ; les 600 lectures correspondent bien à 20/s pendant les 30 secondes de charge. Le SHA de cette mesure est `d788c51` ; le changement suivant porte uniquement sur le workflow CI.

Rapports : `quality/reports/bang/k6-smoke.json` et `quality/reports/bang/k6-load.json`, journaux dans `quality/reports/bang/recette-charge/`. Ils contiennent le résumé détaillé k6, les seuils et les comptages des tables. La charge utilise des invités sans compte : elle ne mesure pas une connexion à Supabase. C'est une mesure locale courte sur le moteur en mémoire, pas une mesure de capacité de production ni d'endurance. Aucun parcours clavier ou téléphone n'est ajouté.

## Cycles rouge / vert et limites constatées

- Les tests Node doublent le client HTTP, collaborateur de `startTable` et `playTurn`. Un premier rouge a constaté l'absence de table, un autre un démarrage 409 accepté à tort, puis l'absence des commandes attendues. Les tests passent après leur raccordement minimal.
- Le test d'effet reçoit des 204 mais une main incorrecte : il était rouge avant la vérification des vues finales et passe après. Un refus de commande 500 arrête également la séquence.
- Le premier profil rapide réel a échoué malgré des commandes HTTP réussies. La comparaison par `JSON.stringify` était sensible à l'ordre des champs entre la préparation k6 et ses VU. Le test a reproduit le rouge avec les mêmes cartes et des champs réordonnés ; la comparaison explicite des identifiants et types corrige le comparateur de charge. Le backend n'a pas été modifié.
- L'assertion ajoutée à la recette mixte était rouge : le parcours s'arrêtait au siège 4 en `PLAY`. Ajouter sa fin de tour atteint le passage attendu. Le comparatif local/serveur était rouge tant que la pioche n'était pas envoyée à Spring, puis vert après son raccordement HTTP.
- Deux rejeux des neuf E2E ont donné 8/9, sans retry, dans deux scénarios différents. Ils attendaient tous deux le pseudo du titre d'accueil ; la première trace montrait une session connectée et une lecture de profil non terminée au moment de l'échec. Les six fichiers réutilisent maintenant `session.ts`, qui vérifie l'identité attendue par `/api/auth/session` et la présence de la déconnexion, avant d'ouvrir BANG!. Aucune assertion de jeu n'est retirée. Ce contrôle ne prétend pas valider la page de profil. Les rapports et traces en échec sont conservés dans `quality/reports/bang/recette-charge/e2e-neuf-premier-echec/` et `e2e-autre-profil-red/`.
- Un rejeu suivant a été interrompu lors de l'arrêt du serveur de charge local : Vite est devenu injoignable, provoquant un timeout puis trois refus de connexion. Il est conservé dans `e2e-interrompu-arret-charge/` et ne vaut pas validation. Le dernier rejeu est exécuté seul, sans arrêt de processus en parallèle.
- Une attente de session par interrogations supplémentaires restait trop courte lorsque les acquittements de connexion prenaient plus de dix secondes. Le helper commun attend désormais les réponses du navigateur (session initiale, POST de connexion, session avec l'identité attendue), avec une borne de trente secondes. Le scénario a une borne de deux minutes ; aucune commande de connexion n'est répétée et `retries` reste à zéro. Le cas rouge puis vert est conservé dans `e2e-session-poll-red/` et `session-signaux-green.log`.
- Un autre rouge a montré la page bloquée sur « Chargement du jeu… », avant le geste, avec le serveur Vite de développement. La recette sert désormais la version compilée, sans transformer les modules à la demande. Le rapport est conservé dans `e2e-module-vite-red/`.
- Un worker Windows a quitté brutalement avec le code natif `3221226505` lors du premier essai compilé. Ce run interrompu est conservé dans `e2e-worker-windows-interrompu/`. Le comparatif de moteurs utilise désormais quatre `APIRequestContext` et leurs CookieJar, puis les dispose ; il ne crée pas quatre contextes Chromium sans page pour une comparaison uniquement HTTP. La recette mixte conserve ses quatre véritables contextes navigateur. L'incident natif reste une limite observée sur cette machine ; les jobs CI utilisent Ubuntu.

Les journaux `*-red.log` et `*-green.log` du même dossier conservent les assertions observées. Les six tests Node sont verts. Les campagnes PIT et Stryker historiques ne sont pas présentées comme de nouveaux runs : leurs fichiers cibles de production sont inchangés et leurs preuves restent à leur emplacement d'origine.

## Commandes reproductibles

Depuis `frontend/`, sans Stryker simultané :

```powershell
npm run test:e2e:bang
npx playwright show-report reports/bang-e2e/html
npx playwright show-trace reports/bang-e2e/results/review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium/trace.zip
npm run rtm:check
npm run lint
npm run build
```

Depuis la racine :

```powershell
node --test quality/k6/bang-session.test.mjs
```

Pour la charge locale, lancer Spring dans un premier terminal depuis `backend/` avec des valeurs uniquement factices :

```powershell
mvn -B -ntp '-Dspring-boot.run.arguments=--spring.config.import= --server.address=0.0.0.0 --server.port=18081 --GOOGLE_CLIENT_ID=quality-client --GOOGLE_CLIENT_SECRET=quality-secret --SUPABASE_URL=http://127.0.0.1:54330 --SUPABASE_ANON_KEY=quality-anon --SUPABASE_SERVICE_ROLE_KEY=quality-service --SUPABASE_JWT_SECRET=tiki-quality-local-jwt-secret-0123456789 --COOKIE_SECURE=false' spring-boot:run
```

Dans un second terminal à la racine :

```powershell
docker compose -f quality/docker-compose.yml run --rm --no-deps -e BACKEND_URL=http://host.docker.internal:18081 -e PROFILE=smoke k6 run /quality/k6/bang.js
docker compose -f quality/docker-compose.yml run --rm --no-deps -e BACKEND_URL=http://host.docker.internal:18081 -e PROFILE=load k6 run /quality/k6/bang.js
```

Rejeu backend ciblé effectué depuis `backend/` :

```powershell
mvn -B -ntp '-Dtest=BangTurnRecoveryNetworkTest,GameTurnServiceTest,GameShotServiceTest,GameViewServiceTest,InitialDealTest,CardDrawTest,PlayerDistanceTest,ShotRulesTest,ShotDistanceRulesTest' test
```

Le parcours mémoire n'a pas besoin de démarrer PostgreSQL/PostgREST, d'où `--no-deps`. En CI, il réutilise le backend sur 8080 déjà lancé par `quality/`. Sous Linux, les commandes du job transmettent aussi `HOST_UID=$(id -u) HOST_GID=$(id -g)` pour écrire les rapports avec l'utilisateur du runner.

## Résultat final

Le dernier lancement a exécuté les **neuf E2E ensemble**, sous Chromium et avec Spring, sur `f54a600becd8eebb29e810c596de452bdaf6c4d4` : **9 réussites, 0 échec, 0 ignoré, 0 flaky, aucun retry**, en 87,6 secondes. Le JSON du rapport porte ce SHA ; une copie est conservée dans `quality/reports/bang/recette-charge/e2e-neuf-final.json`. Les modifications suivantes portent uniquement sur ce bilan, le cahier de recette et la RTM.

`npm run rtm:check` est vert : 52 exigences, 193 cas dont 192 PASSED, 13 anomalies, aucune rupture. Le cas FAILED existant du pic de charge du lobby reste inchangé ; les cas BANG! sont qualifiés explicitement de recette simulée locale. Lint et build passent, avec l'avertissement ESLint existant côté échecs et l'avertissement de taille des bundles.

Le rejeu ciblé backend est vert : **89 tests, aucun échec ni test ignoré**, dont le scénario réseau Testcontainers réel. Le journal est `quality/reports/bang/recette-charge/backend-bang.log` ; le XML Docker est conservé dans `quality/reports/bang/recette-charge/docker-replay/`. Les six tests Node k6 et le formatage des fichiers front ciblés passent. Les campagnes de mutation et le `mvn clean verify` historiques n'ont pas été relancés : leurs preuves d'origine restent conservées, avec la correspondance de SHA du rebase.

Le serveur de charge local a été arrêté après la mesure. Aucun push, aucune ouverture ou fusion de PR, aucune modification de `dev` ou `main`. La proposition de sous-issue qualité reste locale conformément à la décision précédente d'Antoine. La livraison reste soumise à sa revue et à une future PR relue vers `dev`.
