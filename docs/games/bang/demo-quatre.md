# BANG! — Catalogue et démo réelle à quatre (#61)

Validation initiale locale du 5 novembre 2026 ; la revue corrective est consignée
dans la dernière section. Les issues GitHub #60 et #61 restent ouvertes
pour validation ; les changements sont enregistrés dans des commits locaux.

État courant après la revue de `c7a55ac2` : le premier clic de défausse retire
la carte choisie même si la relecture de fin de tour attend. Le premier clic
valide après la pioche et la fin unique au double clic restent couverts. Deux
défausses ramènent la main de sept à cinq, puis la fin passe au siège 2.
La suite habituelle comprend neuf scénarios avec le vrai serveur.
Le bilan détaillé figure en fin de document. Les sections précédentes conservent
leurs résultats historiques.

## Branches vérifiées

Après les fetchs initial et final, `origin/dev` est à `ece3ce79` et la branche
commune locale/distante `game/bang/implementation` est à `22a11fc1`.
L'ancien repère `c6de4b5` n'est donc plus la tête distante de la branche commune.

Les deux branches de travail partent de **la même branche commune locale vérifiée** :

- `game/bang/60-plateau-tirs`, tête `05b4dd87`.
- `game/bang/61-demo-quatre`, branche active contenant les commits nécessaires de
  la #60 par cherry-pick, puis la reprise de table et les fixtures de démo.

`git merge --no-edit origin/dev` était déjà à jour sur chacune. Après le dernier
`git fetch origin --prune`, les deux contrôles suivants réussissent :

```powershell
git merge-base --is-ancestor origin/dev game/bang/60-plateau-tirs
git merge-base --is-ancestor origin/dev game/bang/61-demo-quatre
```

Le push, toute fusion vers `implementation`, `dev` ou `main`, et la clôture des
issues restent réservés à la validation du propriétaire. Aucun de ces actes n'a
été effectué. Un nouveau fetch et contrôle d'ascendance seront nécessaires avant
une future fusion.

## Critères couverts, par issue

| Issue | Critère | Preuve |
| --- | --- | --- |
| #60 | Quatre tapis, personnages, PV actuels/maximaux, mains comptées et rôles visibles | Gherkin `plateau.feature` de Colleen, et les quatre écrans du scénario réel. |
| #60 | Emplacements d'arme/cartes posées et Planque sur le bon tapis | Scénario existant avec la Planque devant la place 3, sans affichage sur la place 2. Fixture de vue front ; aucune nouvelle route de pose n'est ajoutée. |
| #60 | Sélection et tir depuis le véritable écran en ligne | Premier rouge dans `OnlineTable.test.tsx`, puis vrai POST dans Playwright. |
| #60 | Attente serveur, seule la cible répond, identifiant du tir courant | Tests de l'écran, tests HTTP du moteur et scénario réel avec actualisation/reconnexion. |
| #60 | Esquive, acceptation, PV et mains après résolution | Les quatre sessions voient les mêmes joueurs publics ; le bonus de Bart reste privé. |
| #60 | Un seul effet pour doublon ou réponse périmée | Double clic avec fetch contrôlé, tests HTTP concurrents existants, puis rejeux HTTP réels en 409 sans mutation. Un ancien tir ne résout pas le suivant. |
| #60 | Cartes autorisées de Calamity Janet et décision serveur | Deux rouges/verts d'écran pour les substitutions, contrats du moteur rejoués ; aucun calcul client de dégâts, distance ou bonus. |
| #60 | Régression locale du onzième tour | Gherkin déterministe : 1 carte en pioche, 20 en défausse ; les deux cartes sont piochées et les 37 identifiants sont conservés une seule fois. |
| #61 | Entrée au catalogue multijoueur | Les quatre joueurs filtrent le catalogue et ouvrent l'entrée BANG! existante. Registre et migration existants conservés. |
| #61 | Quatre comptes distincts dans quatre contextes isolés | Connexions par le formulaire réel, création, trois jonctions par code et démarrage à quatre. |
| #61 | Propre rôle/propre main, Shérif connu de tous, confidentialité JSON | Contrôle des champs autorisés dans chaque JSON réellement reçu, absence des mains/rôles secrets adverses, contrôle des rôles visibles et des quatre tapis. |
| #61 | Actualisation ou reconnexion pendant l'attente | Première variante après rechargement, seconde après déconnexion en 204 et nouvelle session HTTP distincte. Même place et même `pendingShot.id`, sans rejoindre ni démarrer de nouveau. |
| #61 | Esquiver, accepter, terminer et passer au joueur suivant | Les deux variantes passent dans le même tour du Shérif Willy ; le tour passe ensuite à la place 2 en DRAW dans les quatre sessions. |

Le code de table est mémorisé dans `sessionStorage`, par compte et par onglet.
Les mains et les rôles viennent exclusivement des lectures authentifiées du serveur.
Une table expirée ou refusée libère le menu de création/jonction. Un stockage
navigateur inaccessible ne bloque pas une partie en cours.

## Distinguer les niveaux de test

- `OnlineTable.test.tsx` remplace `fetch` : vrais composants, vrai client API et
  lecture du cookie CSRF, mais réponses réseau contrôlées. Les Gherkin de Colleen
  sont aussi rejoués ; le scénario local du onzième tour est ajouté à son fichier.
- Pact vérifie les trois routes de tir et leur CSRF. Le fournisseur utilise Spring
  et HTTP réels, avec un double à la frontière du service BANG! ; le moteur est
  vérifié séparément dans ses tests HTTP.
- `e2e-real/bang.spec.ts` ne contient **aucune interception réseau**. Il utilise
  quatre contextes Chromium, quatre comptes de test, les vrais contrôleurs et
  services BANG!, la sécurité de session/CSRF et le vrai catalogue de 37 cartes.
- `BangBrowserApplication`, sous `backend/src/test`, fournit uniquement une
  frontière Supabase locale pour les quatre comptes/profils et un mélange contrôlé
  pour `InitialDeal`. Le vrai code de connexion ouvre les sessions. Les comptes
  ne sont pas créés dans un projet Supabase distant.
- Le mélange fixe donne au Shérif Willy des BANG!, à son voisin Bart des Raté!,
  et conserve la vraie donne. Willy permet les deux variantes dans le même tour ;
  l'acceptation vérifie aussi le bonus de Bart.
- Ces fixtures exigent le profil de test `bang-browser`. Un test Spring vérifie
  qu'elles sont absentes du contexte normal même sur le classpath de test.
  Inspection du JAR produit par `clean verify` : aucune classe `BangBrowser`.

Le stockage de partie reste en mémoire côté serveur et ne survit pas à son
redémarrage. La démo valide le backend BANG! local, sans déploiement distant ni
validation de Supabase hébergé.

## Rouges observés et verts

Le [journal #60](plateau-tirs.md) décrit les rouges successifs : POST de tir absent,
attente ignorée, esquive/acceptation absentes, deux réponses au double clic,
substitutions de Janet absentes, onzième tour refusé et lectures anciennes/lentes.
Le correctif de lecture lente existe sur les deux branches : `1d6e45c8` sur #60,
`976955a` sur #61, avec le même comportement testé.

Pour la #61 :

| Palier | Rouge réellement observé | Vert |
| --- | --- | --- |
| Reprendre après actualisation | Playwright avait créé la table, démarré et tiré ; après `reload`, l'écran revenait à « Jouer à BANG! » et n'avait plus de statut d'attente. Le serveur conservait le tir. Même rouge dans le test de remontage de l'écran. | `9d9549ff` : reprise par lecture de l'état, puis parcours réel jusqu'au tour suivant. |
| Table mémorisée expirée ou refusée | En 403 et 404, « Créer une table » restait introuvable ; le code périmé bloquait la reprise. | `dfc66966` : retour au menu et oubli du code. |
| Reconnexion et isolation | Vérifications complémentaires déjà vertes ; aucune panne artificielle du moteur introduite. Le contrôle lint demandait que les mises à jour aient lieu dans les callbacks de la réponse réseau. | `2840ec3a` : déconnexion attendue, changement de JSESSIONID vérifié, captures, séparation par compte, stockage refusé et fixtures absentes en contexte normal. Lecture refactorisée sans désactivation de règle lint. |

Une exécution navigateur lancée en parallèle de la couverture front a échoué sur
le POST de création avec une erreur réseau (`status: -1` dans la trace). Sa cause
matérielle n'est pas établie. Le rejeu final **isolé** a réussi en 20,4 s, avec les
deux variantes et tous les contrôles. Les exécutions précédentes isolées avaient
aussi réussi ; l'échec parallèle n'est pas compté comme un rouge métier.

## Commandes réellement exécutées et résultats finaux

Depuis `frontend/` :

| Commande | Résultat |
| --- | --- |
| `npm run format -- --log-level warn` | Succès, puis format vérifié sans modification. |
| `npm run format:check` | Succès. |
| `npm run lint` | Succès. |
| `npm run typecheck` | Succès sur les deux branches. |
| `npm test -- src/games/bang` | 176 tests sur #60 autonome ; 181 sur #61 finale. |
| `npm run test:coverage` | 1 485 tests réussis, 123 fichiers ; lignes 93,75 %, branches 87,56 %, fonctions 91,18 %, instructions 92,52 %. Tous les seuils sont conservés. |
| `npm run build` | Succès : compilation TypeScript et build Vite. Avertissements de taille des chunks du dépôt conservés. |
| `npm run test:contract` | 9 interactions réussies, dont les 3 actions de tir ajoutées au Pact versionné. |
| `npm run db:check` | 17 migrations, versions uniques. |
| `npm run rtm:check` | Traçabilité complète : 24 exigences, 85 cas, 5 anomalies. |
| `npm run test:e2e:bang` | 1 scénario réel réussi : quatre contextes/comptes, deux variantes, reconnexion, doublons, confidentialité et tour suivant. |

Depuis `backend/` :

| Commande | Résultat |
| --- | --- |
| `mvn -B -ntp spotless:apply '-Dtest=PactProviderTest' test` | 9 interactions fournisseur réussies. |
| `mvn -B -ntp spotless:apply '-Dtest=fr.tikigaming.games.bang.**' test` | 349 tests BANG! réussis, aucun ignoré. |
| `mvn -B -ntp clean verify` | BUILD SUCCESS : 6 575 cas au total, 6 574 réussis, 1 ignoré ; aucun échec ni erreur. Checkstyle, Spotless, JaCoCo et tests Docker exécutés. |

Le seul cas ignoré est le scénario Échecs « Une pièce clouée devant son roi ne peut
pas quitter la ligne », exclu par le filtre existant `@en-cours`. Aucun test BANG!
n'est ignoré. JaCoCo global : 99,03 % des lignes et 94,86 % des branches. Le dernier
changement après `clean verify` ne touche que la lecture réseau et ses tests front,
revalidés par couverture, compilation et démo réelle.

Les journaux restent locaux sous `frontend/node_modules/.cache/bang-*.log`.
Le dernier rejeu conserve `trace.zip` et les captures `place-1.png` à `place-4.png`
sous `frontend/test-results/bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium/`.
Le plateau a été inspecté visuellement ; ces artefacts générés ne sont pas versionnés.

## Commits locaux

| Palier #60 | Branche #60 | Commit récupéré sur #61 |
| --- | --- | --- |
| Tir depuis l'écran | `c144a7d7` | `2f6a4312` |
| Attente serveur | `a7443d51` | `2eb47e7c` |
| Esquive | `7b6c3513` | `17f48f4d` |
| Acceptation et résultat | `7cbb9727` | `c37307fe` |
| Double clic | `486d01c7` | `60676696` |
| Substitutions Janet | `a333fb82` | `d8ebb2df` |
| Recyclage local | `67241474` | `51864e60` |
| Cas complémentaires | `121e1b99` | `71e7d15b` |
| Réponse ancienne | `e9cd11c4` | `4dc008d3` |
| Double de mélange typé | `fad4559c` | `f73f2ddf` |
| Contrat Pact | `d2776f3e` | `15e90b89` |
| Premier bilan | `a1484290` | `ac5e069e` |
| Lecture lente | `1d6e45c8` | `976955a` (report fonctionnel) |
| Bilan réseau lent | `05b4dd87` | `c75d18dc` |

Les commits propres à la #61 sont `9d9549ff` (reprise et premier parcours réel),
`dfc66966` (table mémorisée inaccessible) et `2840ec3a` (reconnexion, isolation,
preuves et refactorisation). Le présent commit complète le bilan documentaire.

## Revue corrective : merge #60, clic perdu et contrôle du Shérif

Revue du 5 novembre 2026, exclusivement sur `game/bang/61-demo-quatre`.
L'état initial était propre : #60 à `05b4dd87`, #61 à `dbacc510`, branche commune
locale/distante à `22a11fc1`. Les fetchs initial et final laissent `origin/dev`
à `ece3ce79`, déjà ancêtre de la #61 ; aucune intégration supplémentaire de dev
n'était nécessaire.

### Résolution des conflits

`git merge --no-ff --no-commit game/bang/60-plateau-tirs` a reproduit exactement :

- un conflit de contenu dans `OnlineTable.tsx` ;
- un conflit add/add dans `OnlineTable.test.tsx`.

Les deux versions ont été examinées. Les versions #61 reprennent les comportements
et tests #60 et ajoutent la reprise par compte, le nettoyage du stockage de test et
les cas de table expirée/refusée. Elles ont été conservées dans les deux fichiers.
L'arbre résolu, puis l'arbre du commit de merge `3d9390e1`, sont **identiques** à
celui de `dbacc510` : `563612ce23104817dc620aca704b7df9d765a77e`.
Les 181 tests front BANG! passaient après résolution. Le merge est un commit
distinct du correctif ; ses parents sont `dbacc510` et `05b4dd87`.

### TDD outside-in du clic perdu

Le test a été ajouté au vrai `OnlineTable` avant toute modification du code de
production. Seuls `fetch` et l'horloge sont contrôlés ; le client API, l'écran,
le plateau et les cartes restent réels.

1. Créer/ouvrir la table et afficher DRAW.
2. Cliquer sur Piocher, recevoir le 204, garder sa lecture d'état en attente.
3. Avancer l'horloge de 2 000 ms : la lecture périodique suivante applique PLAY.
4. Cliquer une fois sur Finir le tour avant de libérer la première lecture.
5. Compter les requêtes réellement parties vers `/api/games/bang/tables/ABC123/turn/end`.

Rouge effectivement exécuté avec
`npm test -- src/games/bang/OnlineTable.test.tsx` : **0 requête au lieu de 1**,
18 autres tests de ce fichier réussis. Le bouton était présent, mais le verrou
attendait encore la première lecture dans le `finally` de la commande précédente.

Le correctif `be2b0664` conserve l'exclusivité pendant le POST, puis attend une
lecture commencée après sa réponse. Dès qu'une telle lecture est appliquée, le
clic suivant peut partir, même si une lecture plus ancienne attend toujours.
Le test passe au vert : exactement un POST `/turn/end`. Les 182 tests BANG! de
ce palier, le linter et les types passent avant le commit.

Le test complémentaire de `2ea815f6` vérifie ensuite qu'une vieille lecture qui
se termine ne libère pas le POST suivant encore en cours : le double clic conserve
un seul POST. Une autre réponse PLAY ancienne arrivant après le passage au joueur
suivant ne remplace pas la vue DRAW de la place 2. Les tests existants de double
réponse et de lectures désordonnées restent verts. Aucune refactorisation
supplémentaire du domaine n'a été nécessaire.

### Démo et sièges Shérif

`npm run test:e2e:bang` a réussi : **1 scénario, 21,1 s** (32,4 s avec le lancement
des serveurs). Quatre contextes Chromium et quatre comptes distincts parcourent
le catalogue, créent/rejoignent la table et démarrent. Le Shérif tire ; sa cible
esquive après actualisation, puis accepte après déconnexion et nouvelle session.
Le bonus de Bart, les quatre résultats publics, la confidentialité JSON et le
passage à la place 2 en DRAW sont vérifiés. Un seul POST de fin de tour, émis par
le compte de la place 1, est observé. Les routes BANG! ne sont pas interceptées ;
la frontière Supabase de test décrite plus haut est conservée.

La vérification des rôles compte les **sièges distincts**, en dédupliquant le rôle
privé et le rôle public du même Shérif. Résultat dans chacune des quatre vues :
`[1]`. Les rôles privés sont `SHERIFF`, `OUTLAW`, `OUTLAW`, `RENEGADE`. Chaque écran
montre un seul tapis Shérif, celui de la place 1 : en bas, à droite, en haut puis
à gauche selon le compte observateur. Une pièce jointe `roles-par-siege` est
conservée dans la trace. Les quatre captures ont également été inspectées.

`7c16e3f4` complète ce contrôle sur le vrai `LocalTable`, avec uniquement le mélange
déterministe : quatre tours sont joués par les boutons de pioche, fin et défausse.
À chaque passage de l'écran, le même siège 1 est l'unique Shérif. Aucun cas de deux
tapis distincts affichant ce rôle n'a été reproduit ; les règles, cartes et
personnages de Colleen sont conservés.

Les artefacts de ce rejeu restent dans :

```text
D:\COURS\SDV_2026_2027\tiki-gaming\frontend\test-results\bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium\
```

Fichiers : `trace.zip`, `place-1.png`, `place-2.png`, `place-3.png`, `place-4.png`.

### Vérifications finales de cette revue

| Commande réellement exécutée | Résultat |
| --- | --- |
| `npm test -- src/games/bang` | 184 tests réussis, 10 fichiers. |
| `npm run format -- --log-level warn` puis `npm run format:check` | Succès. |
| `npm run lint` et `npm run typecheck` | Succès. |
| `npm run test:coverage` | 1 488 tests réussis, 124 fichiers ; lignes 93,78 %, branches 87,57 %, fonctions 91,55 %, instructions 92,59 %. |
| `npm run build` | Succès, avec les avertissements existants de taille des chunks. |
| `npm run test:contract` | 9 interactions réussies ; Pact régénéré sans différence de contenu. |
| `npm run db:check` et `npm run rtm:check` | Succès : 17 migrations, traçabilité complète. |
| `mvn -B -ntp '-Dtest=fr.tikigaming.games.bang.**' test` | 349 tests réussis, aucun ignoré, en rejeu isolé. |
| `mvn -B -ntp spotless:apply clean verify` | BUILD SUCCESS sur le checkout détaché du commit `7c16e3f4` : 6 574 réussis, 1 ignoré, zéro échec/erreur. |

Le lancement ciblé backend en parallèle de la couverture avait rencontré un timeout
HTTP de 5 s dans `PrivateTablesCsrfHttpTest.swaggerMatchesTheJsonCsrfResponseFromTheEmbeddedServer`.
Le rejeu ciblé isolé est vert sans modification Java ni augmentation de délai.
Le `mvn clean verify` dans le dépôt principal a ensuite été empêché dès `clean`
par un journal déjà ouvert dans `backend/target/local-run`.

La validation complète a donc utilisé un checkout temporaire propre, au même
commit, sans arrêter le processus existant ni supprimer son journal. Les vrais
objectifs `clean` et `verify` ont été exécutés, sans désactivation de contrôle.
Le checkout a été retiré après conservation des journaux et de JaCoCo. Le seul cas
ignoré reste le scénario Échecs `@en-cours` décrit plus haut ; aucun BANG! n'est
ignoré. JaCoCo reste à 99,03 % des lignes et 94,86 % des branches.

Preuves locales : `frontend/node_modules/.cache/bang-review-*.log` et
`bang-review-jacoco.xml`, notamment `bang-review-backend-isolated.log` pour le succès
complet, et `bang-review-targeted-timeout.log` pour la première tentative ciblée.

Après le dernier fetch, ces deux commandes réussissent :

```powershell
git merge-base --is-ancestor origin/dev game/bang/61-demo-quatre
git merge-base --is-ancestor game/bang/60-plateau-tirs game/bang/61-demo-quatre
```

Commits locaux de la revue : `3d9390e1` (merge résolu), `be2b0664` (rouge/vert du
clic), `2ea815f6` (verrou et démo/sièges), `7c16e3f4` (mode local), puis le présent
bilan documentaire. La #61 est proposée pour revue avant fusion dans
`game/bang/implementation`. Aucun push, aucune fusion vers cette branche commune
et aucune clôture d'issue ne sont effectués.

## Revue de `109a2990` — invités, tir local et réponse de pioche

### Base et ordre TDD (5 novembre 2026)

Le dépôt était propre sur la branche existante `game/bang/61-demo-quatre`, à
`109a2990`. Le fetch retrouve `origin/dev` à `ece3ce79`, déjà ancêtre : aucun
nouveau merge de dev n'est nécessaire. La #60 (`05b4dd87`) est déjà intégrée par
`3d9390e1`. Les comparaisons confirment que ce merge n'a pas modifié les deux
fichiers `OnlineTable.tsx` / `OnlineTable.test.tsx` de sa première parenté, et que
son arbre entier est identique à `dbacc510`. Les conflits restent résolus ; la
branche commune `game/bang/implementation` reste à `22a11fc1`.

Avant toute modification de production, les deux fichiers de reproduction ont
été repris depuis l'archive `revue-61-109a2990-bf9e7cq1`, puis la commande demandée
a été exécutée dans `frontend/` :

```powershell
npx playwright test --config playwright.lecture.config.ts
```

Résultat réellement observé : **3 échecs métier**, conservés dans
`frontend/node_modules/.cache/bang-61-three-reds.log`. Les tests de composant ou
HTTP ont ensuite guidé chaque étape, avec commits locaux au vert. Les composants,
le client HTTP, les vues et les règles sont réels ; seuls le transport, l'horloge
ou le mélange utiles au comportement sont contrôlés.

| Comportement | Rouge exécuté avant le correctif | Commit(s) vert(s) |
| --- | --- | --- |
| Clic pendant la réponse du POST de pioche | Vrai serveur en PLAY, bouton actif, un clic, réponse de pioche libérée : **0 POST `/turn/end` au lieu de 1**. Même échec du vrai composant avec fetch et horloge contrôlés. | `2711bea0` : retient une seule commande suivante après application d'une lecture postérieure à la pioche, puis l'envoie à l'accusé de réception. Tests avec mains de 4 et 6 cartes, clic simple/double, état suivant ou DISCARD. |
| Tir sur le même écran | Main **7 → 7**, message « Le tir n'est pas encore disponible », aucune réponse possible. Le test de composant observe aussi l'absence de passage privé à la cible. | `e2ebd57b` : BANG ! défaussé, tir en attente et passage d'écran sans main ni rôle privé. |
| Esquive locale | Bouton d'esquive absent dans le test de composant sur un tir réel. | `2c09b11d` : carte autorisée défaussée, aucun PV perdu, écran rendu au tireur dans le même tour. |
| Acceptation locale | Bouton d'acceptation absent après le tir ; test de composant rouge. | `c239e18e` : exactement un PV perdu, maximum conservé, bonus de Bart survivant et retour au tireur. |
| Choix indépendant du compte | « En ligne » absent pour les invités dans le navigateur et les tests de composant ; le compte n'avait pas le choix local non plus. | `3a8c6ed8` : deux choix pour chaque joueur, préférence conservée après actualisation. |
| Jonction des invités | Après accès au formulaire, les deux jonctions par l'interface renvoient encore **401 / 401** ; le nouveau test HTTP du vrai moteur attend 200 et reçoit 401. | `06c63a14` : identités invitées de session, sièges distincts, reprise, vues privées et actions BANG !. |
| Session invitée perdue | En 401, le code mémorisé bloquait le retour au formulaire ; test de composant rouge. | `1446033f` : oubli du code et retour à la création/jonction, comme en 403/404. |

`25485e4c` intègre les trois reproductions à `npm run test:e2e:bang`, complète les
garde-fous locaux et retire le message de tir indisponible devenu inutile. Les
tests de portée, limite, substitutions et bonus sont ajoutés au vert, sans
fabriquer de nouveaux rouges. `2101ee1d` ajoute les contrats de jonction et de vue
invitée, ainsi que leur vérification fournisseur.

### Identités invitées et confidentialité

Créer ou rejoindre sans compte attribue un identifiant aléatoire côté serveur,
uniquement dans la session HTTP BANG !. La session est renouvelée à sa première
attribution. L'initialisation est synchronisée ; une nouvelle requête de la même
session réutilise cet identifiant. Un compte garde sa reprise par compte, même
dans une nouvelle session HTTP. Aucun identifiant de siège ou de compte fourni
par le client n'est utilisé comme identité.

Le navigateur ne mémorise que le code de table et le choix du mode. Le cookie de
session permet la reprise après actualisation ou interruption réseau ; le code
seul ne restitue pas un siège à un nouveau navigateur. Après perte du cookie ou
expiration, l'invité ne peut pas revendiquer son ancien siège par le code. Les
tables restent en mémoire et expirent après une heure sans action acceptée.

Les tests HTTP traversent Spring, le CSRF et le vrai moteur avec uniquement le
mélange contrôlé. Ils vérifient deux invités distincts, leurs reprises à table
pleine, la main et le rôle propres à chacun, le tir/esquive/acceptation, le bonus
de Bart, le refus d'un acteur autre que la cible et d'une réponse périmée. Une
session neuve est refusée en lecture ; une nouvelle jonction à table pleine ne
prend pas la place demandée dans des paramètres falsifiés. Toutes les mutations
restent refusées avec un CSRF absent ou erroné.

### Rejeux réels et siège Shérif

La suite habituelle comprend désormais quatre tests Chromium, sans retry :

1. Quatre comptes dans quatre contextes isolés, depuis le catalogue : création,
   jonction, tir du Shérif, esquive après actualisation, acceptation après
   reconnexion avec nouvelle session, bonus de Bart, rejet des anciennes réponses,
   confidentialité JSON et passage au joueur suivant.
2. Quatre personnes sur le même écran : BANG ! défaussé (7 → 6), mains/rôles privés
   masqués pendant chaque passage, vrai Raté ! défaussé sans dégâts, second tir
   refusé sans perte de carte, Bart survivant qui pioche, passage par les quatre
   places, puis cible ordinaire à 4/4 → 3/4. Le tireur reprend son même tour après
   chaque réponse.
3. Deux comptes et deux invités dans quatre contextes isolés : jonctions par les
   formulaires, mains/rôles JSON isolés, passage des deux comptes, tir de Janet
   invitée et bonus de Bart, tir de Paul invité, actualisation de Janet en attente,
   vraie coupure réseau de Paul puis reprise avec le même siège/main/tir, esquive
   et retour au même tour. `/api/auth/session` reste exactement `{ "user": null }`
   pour les deux invités, sans JWT.
4. Réponse du POST de pioche retenue après son acceptation par le vrai serveur :
   une lecture affiche PLAY, le joueur clique une seule fois, puis la réponse est
   libérée. Exactement un POST `/turn/end` et état **DISCARD**, siège 1, main de
   sept cartes pour cinq PV. Aucun deuxième clic ni sommeil arbitraire.

Pour les trois configurations de jeu, le contrôle compte les tapis/sièges, pas
les occurrences du mot « Shérif ». Chaque vue désigne uniquement le siège 1,
avec une orientation différente autour du plateau. Les rôles privés sont un
Shérif, deux Hors-la-loi et un Renégat. Aucun cas de deux tapis distincts Shérifs
simultanés n'est reproduit. Les cartes et personnages de Colleen ne sont pas
modifiés ; leurs contrats passent, y compris Janet, Willy, Paul et Bart. Les
contrôles locaux vérifient aussi la conservation des 37 cartes, les refus sans
mutation, les tirs bloquants, le recyclage du bonus et l'absence de bonus après
élimination de Bart.

Les traces et les quatre captures de chaque configuration sont conservées sous
`frontend/test-results/` (artefacts ignorés par Git) :

| Configuration | Sous-répertoire | Fichiers |
| --- | --- | --- |
| Quatre comptes | `bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium` | `trace.zip`, `place-1.png` à `place-4.png` |
| Même écran | `review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium` | `trace.zip`, `place-locale-1.png` à `place-locale-4.png`, `tir-local.png` |
| Deux comptes / deux invités | `review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium` | `trace.zip`, `place-mixte-1.png` à `place-mixte-4.png` |
| Clic / POST retardé | `review.probe-un-seul-clic--88735-nse-du-POST-de-pioche-tarde-chromium` | `trace.zip` |

Racine absolue : `D:\COURS\SDV_2026_2027\tiki-gaming\frontend\test-results\`.
Les captures de la place invitée Janet et de la réponse locale de Janet ont aussi
été inspectées visuellement. Les autres vues sont contrôlées par leurs tapis et
leur JSON dans Playwright. `playwright.lecture.config.ts` reste disponible pour
rejouer seulement les trois reproductions, dans `test-results-revue/`.

### Scores : garanties actuelles et raccordement restant

Le mode local ne reçoit aucun port de score, même lancé par un compte. Le jeu
BANG ! n'appelle actuellement ni `ctx.submitScore` ni la file de scores, dans
aucun mode. Une identité invitée BANG ! ne devient pas un `AuthUser` ; les tests
HTTP tentent explicitement un `POST /api/scores` avec un résultat déclaré terminé
pour chacun des deux invités et obtiennent 401. Le SDK invité ne publie et ne met
pas de score en attente.

Il manque encore la détection/résolution de victoire BANG !, un résultat final
serveur attribué aux participants, le barème et son validateur, puis le branchement
de publication réservé aux **comptes en ligne**. Le POST générique de scores
n'est pas encore relié à un résultat BANG ! validé : son futur validateur devra
vérifier côté serveur la partie, sa fin et le compte participant, sans faire
confiance à un champ client « local/en ligne ». Les parties locales et sièges
invités devront rester exclus de ce branchement et de sa file de reprise.

Il n'existe donc pas de parcours de fin de partie/classement BANG ! validé dans
cette livraison. L'absence d'un POST de score pendant les tours de la démo n'est
pas utilisée comme preuve de son comportement à la fin. Aucun score final de
compte BANG ! n'est encore publié non plus.

### Contrôles de cette livraison

| Commande exécutée | Résultat |
| --- | --- |
| `npx playwright test --config playwright.lecture.config.ts` avant le code de production | 3 rouges métier décrits ci-dessus. |
| Même commande après corrections | 3 verts, dont les tirs/reprises des invités (43,4 s avec lancement des serveurs). |
| `npm run test:e2e:bang` sur le résultat final | **4 tests réussis**, sans retry, en 1,1 min avec les serveurs : comptes, local, mixte et POST de pioche retardé. |
| `npm test -- src/games/bang` | 205 tests réussis dans 11 fichiers. |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Succès. |
| `npm run test:coverage` | 1 509 tests réussis, 125 fichiers. Lignes 93,84 %, branches 87,75 %, fonctions 91,70 %, instructions 92,63 % ; tous les seuils passent. |
| `npm run build` | Succès ; avertissement existant sur les gros chunks conservé. |
| `npm run test:contract` | 11 interactions consommateur réussies, Pact régénéré et versionné. |
| `npm run db:check`, `npm run rtm:check` | 17 migrations uniques ; traçabilité complète, 24 exigences et 85 cas. |
| `mvn -B -ntp spotless:apply '-Dtest=fr.tikigaming.games.bang.**,PactProviderTest' test` | 372 réussites : 361 tests BANG ! et 11 interactions fournisseur, aucun ignoré. |
| `mvn -B -ntp clean verify` dans `backend/` du dépôt principal | **BUILD SUCCESS** : 6 589 tests au total, 6 588 réussis, 1 ignoré ; zéro échec/erreur. Compilation, Checkstyle, Spotless, contrats, tests Docker et seuils JaCoCo passent. |

Contrairement à la validation historique du précédent bilan, le `clean verify`
de cette livraison réussit directement dans le dépôt principal : aucun journal
n'y bloque désormais `clean`. Aucun processus existant n'a été arrêté. L'unique
cas ignoré reste le scénario Échecs filtré `@en-cours`, aucun BANG ! n'est ignoré.
JaCoCo global : lignes 99,03 %, branches 94,88 %. Le JAR produit ne contient
aucune classe de fixture `BangBrowser`. Le rapport est aussi conservé sous
`frontend/node_modules/.cache/bang-61-jacoco.xml`.

Preuves conservées dans `frontend/node_modules/.cache/bang-61-*.log`, notamment
`three-reds`, `modes-component-red`, `guests-http-unit-red`,
`guest-session-expired-red`, `front-targeted`, `front-coverage`, `front-build`,
`contract-consumer`, `backend-targeted`, `clean-verify` et `e2e-final`. Les rouges
de tir/esquive/acceptation locale sont aussi conservés dans `local-*-red.log`.

`7684a879` vérifie par les vrais boutons qu'un deuxième
tir local de Bart est refusé dans le même tour, avec ses six cartes conservées et
sans passage à la cible. Aucun nouveau correctif de règle n'était nécessaire.

Le dernier `git fetch origin --prune` retrouve `origin/dev` à `ece3ce79` et la
#60 à `05b4dd87`, tous deux ancêtres de la #61. La branche commune locale/distante
reste à `22a11fc1`. Les commits restent locaux sur `game/bang/61-demo-quatre` :
aucun push, merge dans `game/bang/implementation` ni clôture d'issue.

## Revue de `586486ba` — clic après le 204 et partie locale conservée

### Base et rouges réellement observés (5 novembre 2026)

La tête initiale est bien `586486ba`, sur la branche existante
`game/bang/61-demo-quatre`, sans changement local à déplacer. Après
`git fetch origin --prune`, `origin/dev` (`ece3ce79`) et
`origin/game/bang/implementation` (`22a11fc1`) sont déjà des ancêtres. Aucun merge
supplémentaire n'est nécessaire. Les règles, cartes, personnages et le moteur
d'Antoine et Colleen sont réutilisés sans modification.

Les deux fichiers fournis dans `controle-61-586486ba-9r78202g/frontend/` sont
repris, puis cette commande est exécutée **avant toute modification de production** :

```powershell
npx playwright test --config playwright.controle-limites.config.ts
```

Les deux scénarios échouent sur le comportement attendu, avec le vrai serveur :

| Comportement | Rouge navigateur | Test intérieur rouge | Commit vert |
| --- | --- | --- | --- |
| Clic après réception du 204 de pioche, lecture suivante retenue | **0 POST `/turn/end`**, serveur encore en **PLAY** après le clic unique et la libération de la lecture. | Vrai `OnlineTable`, fetch et horloge contrôlés : 0 POST au lieu de 1, clic simple comme double. | `6c8bb227` : après acquittement du POST, libère le verrou si une vue postérieure à la commande est déjà appliquée. Vert réel : 1 POST, siège 1 en DISCARD, sept cartes pour cinq PV. |
| Clic retenu avant le 204 devenu invalide | Le scénario joueur initial guide la correction ; ce garde-fou complète le test intérieur. | Une fin de tour part malgré une nouvelle vue indiquant un autre joueur, DISCARD, un tir en attente ou une session perdue : **1 POST au lieu de 0** dans les quatre cas. | `5cbae880` : le clic retenu appartient au code/siège, joueur actif, phase et tir affichés. Une intention dont le contexte a changé est abandonnée. |
| Détour par En ligne puis retour au même écran | Main **7 → 5**, nouvelle distribution et message « pioche tes deux cartes ». | Même perte dans `BangGame` réel, avec ou sans compte ; seul le mélange est contrôlé. | `dd34038e` : garde `LocalTable` monté en mémoire et masque son conteneur quand le mode en ligne est actif. Au retour : mêmes cartes, joueur, PV et phase ; aucun nouveau mélange. |

La première correction n'ajoute ni attente réelle ni deuxième clic. Le POST reste
exclusif pendant son envoi ; le clic avant le 204 reste retenu une seule fois. Les
tests de lecture ancienne et de double clic sont conservés. Dans le nouveau test,
la lecture PLAY retenue arrive après la lecture DISCARD du POST de fin de tour :
elle ne fait pas reculer le plateau.

La conservation locale réutilise tous les états existants de `LocalTable`, y
compris le siège autorisé à regarder l'écran, le tir en attente et le tour du
tireur. Aucun transfert de partie vers le serveur et aucune sauvegarde locale ne
sont ajoutés. Les tests vérifient aussi l'aller-retour pendant le passage vers la
cible **et** pendant le retour au tireur : la main et le rôle privé restent
absents jusqu'au bouton de confirmation. Un BANG ! puis un vrai Raté ! peuvent
être joués après le détour, dans le même tour.

`67172923` intègre les deux reproductions dans `npm run test:e2e:bang`, ajoute les
contrôles de passage privé et d'absence d'envoi/file de score dans les parcours,
et corrige une option de Testing Library signalée par TypeScript. Les quatre
scénarios précédents sont conservés.

### Démo complète et portée des preuves

`npm run test:e2e:bang` réussit : **6 tests, sans retry**, en 1,2 min avec le
lancement des serveurs. Chromium et les vrais contrôleurs/services BANG ! sont
utilisés ; seules les frontières Supabase de test et le mélange de la démo restent
contrôlés, comme précédemment.

- Quatre comptes isolés : catalogue, création/jonction, tir du Shérif, esquive
  après actualisation, acceptation après reconnexion, bonus Bart, confidentialité
  JSON, refus des anciennes réponses et joueur suivant.
- Deux comptes et deux invités : sièges 3/4 distincts, mains/rôles isolés,
  tirs/réponses, reprises après actualisation et coupure réseau. Les invités
  restent sans `AuthUser`/JWT ; aucun POST de score ni score en file dans ce parcours.
- Quatre joueurs locaux : défausse du BANG ! et du Raté !, perte exacte d'un PV,
  bonus Bart survivant, refus du second tir sans perte de carte et retour au tireur.
- Clic pendant la réponse du POST de pioche, scénario existant conservé : 1 POST,
  puis DISCARD.
- Clic après le 204 et avant la lecture suivante : 1 POST, puis DISCARD.
- Aller-retour entre modes avec sept cartes, puis pendant les deux passages
  privés. Le joueur poursuit son même tour ; aucun score local envoyé ni mis en file.

Les trois configurations de joueurs continuent de désigner **un seul siège
Shérif**, le siège 1, malgré les orientations différentes. Les mains et rôles
privés des autres joueurs ne sont pas transmis dans les JSON en ligne. Le passage
privé après retour de mode est aussi inspecté sur la capture `passage-prive-2.png`.

Un incident de lancement a interrompu PowerShell lors du rejeu local, puis un
second lancement a trouvé le port 18080 occupé. Le processus orphelin a été
identifié par son application `BangBrowserApplication` et son heure de création ;
seuls ce serveur de test et son lanceur ont été arrêtés. Le rejeu isolé a ensuite
réussi, puis les six scénarios ont réussi ensemble. Cet incident n'est pas compté
comme un rouge métier. Aucun timeout de serveur n'a été transformé en assertion
de règle du jeu.

### Traces et captures de cette revue

Racine absolue du dernier rejeu :
`D:\COURS\SDV_2026_2027\tiki-gaming\frontend\test-results\`.

| Scénario | Sous-répertoire (contient `trace.zip`) | Captures |
| --- | --- | --- |
| Quatre comptes | `bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium` | `place-1.png` à `place-4.png` |
| Deux comptes / deux invités | `review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium` | `place-mixte-1.png` à `place-mixte-4.png` |
| Même écran | `review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium` | `place-locale-1.png` à `place-locale-4.png`, `tir-local.png` |
| Clic avant le 204 | `review.probe-un-seul-clic--88735-nse-du-POST-de-pioche-tarde-chromium` | Trace |
| Clic après le 204 | `controle-limites-le-clic-e-42f94-lle-lecture-termine-le-tour-chromium` | Trace |
| Modes et passage privé | `controle-limites-un-détour-a85ee-la-partie-sur-le-même-écran-chromium` | `retour-mode.png`, `passage-prive-2.png`, `passage-prive-1.png` |

Les traces rouges réellement produites avant le correctif sont conservées dans
`frontend/node_modules/.cache/bang-61-limites-red-traces/`. Les logs de cette revue
sont préfixés `bang-61-limites-` dans ce même cache : `acceptance-red`,
`clic-component-red`, `intention-red`, `modes-component-red`, leurs verts et
`e2e-final`. Les archives de la revue fournie sont conservées à leur emplacement
initial sans modification.

### Commandes et résultats finaux

Commandes exécutées dans `frontend/`, sauf la dernière dans `backend/` :

| Commande | Résultat |
| --- | --- |
| `npx playwright test --config playwright.controle-limites.config.ts` avant le code de production | Les deux rouges métier décrits plus haut. |
| Même commande avec `--grep 'le clic entre'` après son correctif | 1 vert : exactement un POST, état DISCARD. |
| Même commande avec `--grep 'un détour'` après son correctif | 1 vert : sept cartes conservées, même tour. |
| `npm test -- src/games/bang/OnlineTable.test.tsx` | 30 réussites : clic avant/après le 204, double clic, réponse ancienne et intentions périmées. |
| `npm test -- src/games/bang/BangGame.test.tsx src/games/bang/LocalTable.test.tsx` | 11 réussites, avec/sans compte, reprise et confidentialité pendant les passages. |
| `npm test -- src/games/bang` | **215 tests réussis**, 11 fichiers. |
| `npm run test:e2e:bang` | **6 réussites**, zéro retry, 1,2 min avec les serveurs. |
| `npm run format -- --log-level warn`, `npm run format:check`, `npm run lint`, `npm run typecheck` | Succès. |
| `npm run test:coverage` | **1 519 réussites**, 125 fichiers. Lignes 93,84 %, branches 87,77 %, fonctions 91,70 %, instructions 92,64 % ; tous les seuils passent. |
| `npm run test:contract` | **11 interactions réussies**, contrat régénéré sans modification de contenu. |
| `npm run build` | Succès, avertissement existant sur la taille des chunks conservé. |
| `npm run rtm:check`, `npm run db:check` | Traçabilité complète (24 exigences, 85 cas), 17 migrations uniques. |
| `mvn -B -ntp clean verify` | **BUILD SUCCESS** dans le dépôt principal : 6 589 tests au total, **6 588 réussis**, un scénario Échecs ignoré par le filtre existant `@en-cours`, zéro échec/erreur. Contrats fournisseur, tests Docker, Checkstyle, Spotless et JaCoCo passent ; aucun BANG ! ignoré. |

Les sorties sont conservées dans `frontend/node_modules/.cache/`, préfixées
`bang-61-limites-`, notamment `front-targeted.log`, `front-coverage.log`,
`contract.log`, `front-build.log`, `e2e-final.log` et `clean-verify.log`.
Le rapport JaCoCo est aussi conservé dans `bang-61-limites-jacoco.xml`.
Couverture JaCoCo : lignes 99,03 %, branches 94,88 %.

### Limites conservées

L'état local reste en mémoire tant que l'écran BANG ! reste monté. Un rechargement
ou redémarrage ne restaure pas cette partie, conformément au périmètre demandé.
Le code de table et le choix du mode restent mémorisés comme avant pour les
reprises en ligne.

Les contrôles de score portent sur les parcours joués et sur les frontières
existantes : local sans port de score, SDK invité sans publication/file et refus
HTTP de score invité. La détection de victoire, le barème et la publication d'un
résultat BANG ! validé pour les seuls comptes en ligne restent à raccorder comme
dans le bilan précédent. L'absence de score pendant un tour ne prouve pas un
parcours de fin de partie encore absent.

### Remise de la branche

Le fetch final et les deux commandes suivantes confirment les ascendances :

```powershell
git fetch origin --prune
git merge-base --is-ancestor origin/dev game/bang/61-demo-quatre
git merge-base --is-ancestor origin/game/bang/implementation game/bang/61-demo-quatre
```

Les références restent respectivement `ece3ce79` et `22a11fc1`. Les commits de
cette revue sont `6c8bb227`, `5cbae880`, `dd34038e`, `67172923`, puis le présent
bilan. Ils restent locaux sur la #61, pour relecture. Aucun push, aucune PR,
aucune fusion vers la branche commune, `dev` ou `main` n'ont été effectués.

## Revue de `c4d9b75e` — première lecture PLAY livrée après le 204

### Base, reproduction et TDD (5 novembre 2026)

Le dépôt est initialement propre, sur `game/bang/61-demo-quatre`, à la tête
`c4d9b75e`. Après `git fetch origin --prune`, `origin/dev` (`ece3ce79`) et
`origin/game/bang/implementation` (`22a11fc1`) sont déjà des ancêtres. Aucun
merge supplémentaire n'est nécessaire.

Le test fourni dans `revue-61-c4d9b75e-0sdresna/frontend/e2e-real/` est repris
dans `frontend/e2e-real/revue-lectures.spec.ts`, puis ajouté au `testMatch` de la
suite habituelle. Avant toute modification de production :

```powershell
npm run test:e2e:bang -- --grep "un clic reste valide"
```

**Rouge métier réellement observé** : la première lecture a obtenu PLAY sur le
vrai serveur, mais sa réponse est retenue. Le navigateur reçoit le 204 de pioche
et lance une deuxième lecture, elle aussi retenue. La première réponse est alors
livrée : le bouton apparaît et est actif. Après un seul clic et libération de la
deuxième lecture, **0 POST `/turn/end`**, siège 1 toujours en **PLAY**. Le résultat
et l'ordre des événements figurent dans l'attachement `ordre-et-etat` de la trace.

Le test intérieur traverse le vrai `OnlineTable`, `GameScreen`, le plateau et le
client API. Seuls fetch et l'horloge sont contrôlés. Il retient séparément les deux
lectures et l'acquittement de pioche, puis les livre dans le même ordre. Avant la
livraison de la première lecture, « Finir le tour » est absent ; il apparaît
seulement ensuite. Les variantes clic simple et double échouent toutes deux :
**0 POST au lieu de 1**. Aucun délai réel ni deuxième clic de rattrapage.

### Correctif minimal et garde-fous

`953cfd5` change une seule ligne de production. Après le 204, la borne attendue
est celle mémorisée au **début de la commande**, `sending.current.afterRead`, et
non celle de la dernière lecture déjà lancée. Ainsi, la première lecture encore
en vol peut libérer le clic, sans imposer l'arrivée de la lecture suivante.

Vert du composant puis du même navigateur : **exactement un POST `/turn/end`**,
siège 1 en **DISCARD**, sept cartes pour cinq PV. Le test intérieur livre ensuite
l'ancienne deuxième réponse PLAY après la nouvelle vue DISCARD : le plateau ne
recule pas. Les 32 tests de `OnlineTable` passent, y compris les deux autres ordres
de réponse, le double clic et l'abandon d'un clic retenu quand le joueur, la phase,
le tir ou la session changent. Aucun refactor supplémentaire n'est nécessaire.

La fixture de navigateur propose désormais cinq comptes locaux de test pour les
cinq tables indépendantes de la suite : chacune a son propre créateur, car un
compte ne peut créer qu'une table ouverte. Le nouveau scénario emploie les comptes
5, 1, 2, 4 ; chaque partie reste à quatre joueurs. Le scénario rouge initial avait
été rejoué sans changement de ses comptes fournis. Le contrôle des réponses et
les points de synchronisation du test restent identiques. Le helper inutilisé et
le `console.log` de la reproduction sont retirés ; l'attachement JSON est conservé.

Ces comptes ne sont exposés que par `BangBrowserApplication`, sous `src/test`,
dans le profil `bang-browser`. Le test d'isolation du contexte normal passe. La
donne, les cartes, les personnages, les règles de Colleen et les API de production
restent inchangés.

### Démo à quatre et traces des sept scénarios

Les sept scénarios sont exécutés ensemble avec Chromium, un worker et
`retries: 0`, sur le vrai serveur Spring et le vrai moteur BANG !. Le premier
rejeu complet isolé est vert en 1,5 min. Le dernier rejeu, sur le commit
`bd1e77cf362a2b97ede981873f23b0599e75acc3`, est également **vert : 7 réussites en
1,5 min, zéro retry**. Son SHA est conservé dans
`frontend/node_modules/.cache/bang-61-lectures-tested-sha.txt`.

Racine des artefacts du dernier rejeu :
`D:\COURS\SDV_2026_2027\tiki-gaming\frontend\test-results\`.

| Scénario | Résultat attendu vérifié | Sous-répertoire contenant `trace.zip` |
| --- | --- | --- |
| Quatre comptes en ligne | Catalogue, création/jonctions, tir du Shérif, esquive après actualisation, acceptation après reconnexion, bonus Bart, vues privées et joueur suivant. | `bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium` |
| Deux comptes / deux invités | Sièges 3/4 distincts, mains/rôles JSON isolés, tirs, reprises après actualisation et coupure réseau, aucun envoi/file de score invité. | `review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium` |
| Quatre joueurs sur le même écran | BANG ! et Raté ! défaussés, dégâts et bonus Bart, cartes conservées après refus, passage privé et même tour rendu au tireur. | `review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium` |
| Conservation après changement de mode | Sept cartes conservées, même joueur/PV/phase, main masquée pendant les passages vers la cible et vers le tireur. | `controle-limites-un-détour-a85ee-la-partie-sur-le-même-écran-chromium` |
| Clic avant le 204 | PLAY déjà affiché, réponse POST retenue, clic unique : 1 POST de fin et DISCARD. | `review.probe-un-seul-clic--88735-nse-du-POST-de-pioche-tarde-chromium` |
| Clic après le 204, PLAY déjà affiché | Lecture suivante retenue : le clic suffit, 1 POST et DISCARD. | `controle-limites-le-clic-e-42f94-lle-lecture-termine-le-tour-chromium` |
| Première vue PLAY livrée après le 204 | Première lecture et lecture suivante retenues séparément ; le bouton apparaît seulement à la livraison de la première. Un clic, 1 POST, siège 1 en DISCARD. | `revue-lectures-un-clic-res-b922a-4-affiche-PLAY-après-le-204-chromium` |

Les contrôles des trois configurations de joueurs continuent de désigner un seul
**siège Shérif**, le siège 1, avec un rôle privé par joueur et les orientations
locales du plateau. Les captures des quatre places restent dans les dossiers des
scénarios comptes, mixte et local (`place-1.png` à `place-4.png`,
`place-mixte-1.png` à `place-mixte-4.png`, `place-locale-1.png` à
`place-locale-4.png`). La nouvelle trace contient l'attachement `ordre-et-etat`.

Le premier lancement complet a perdu Vite pendant le premier scénario : son
console signalait « server connection lost », puis les scénarios suivants ont
échoué en navigation avec `ERR_CONNECTION_REFUSED`. Cet incident d'exécution,
dont la cause n'est pas établie, est conservé dans
`frontend/node_modules/.cache/bang-61-lectures-e2e-infrastructure.log` et le dossier
`bang-61-lectures-e2e-infrastructure-traces/`. Il n'est pas compté comme un rouge
métier. Le rejeu complet seul, sans autre test en parallèle ni hausse des délais,
est vert. Les retries Playwright restent désactivés.

Le rouge demandé est conservé séparément dans
`frontend/node_modules/.cache/bang-61-lectures-acceptance-red.log` et
`bang-61-lectures-acceptance-red/trace.zip`. Les rouges et verts intérieurs sont
dans `bang-61-lectures-component-red.log` et `bang-61-lectures-component-green.log`.

### Contrôles sur le résultat testé

| Commande | Résultat |
| --- | --- |
| `npm run test:e2e:bang -- --grep "un clic reste valide"` avant le code de production | Rouge réel : 0 POST, siège 1 en PLAY. |
| Même commande après le correctif | Vert réel : 1 POST, siège 1 en DISCARD ; mêmes points de synchronisation. |
| `npm test -- src/games/bang/OnlineTable.test.tsx` | 32 réussites, dont les deux nouvelles variantes après leurs rouges. |
| `npm test -- src/games/bang` | **217 réussites**, 11 fichiers. |
| `npm run test:e2e:bang` sur `bd1e77cf` | **7 réussites ensemble**, Chromium, vrai Spring, zéro retry, 1,5 min avec les serveurs. |
| `npm run format`, `npm run format:check`, `npm run lint`, `npm run typecheck` | Succès. |
| `npm run test:coverage` | **1 521 réussites**, 125 fichiers ; lignes 93,84 %, branches 87,77 %, fonctions 91,70 %, instructions 92,64 %. Tous les seuils passent. |
| `npm run test:contract` | **11 interactions réussies**, Pact régénéré sans différence de contenu. |
| `npm run build` | Succès ; avertissement existant sur la taille des chunks. |
| `npm run rtm:check`, `npm run db:check` | Traçabilité complète : 24 exigences, 85 cas ; 17 migrations uniques. |
| `mvn -B -ntp spotless:apply '-Dtest=BangBrowserIsolationTest' test` | Succès : fixture de navigateur absente du contexte normal. |
| `mvn -B -ntp clean verify` dans `backend/` | **BUILD SUCCESS**, 1 min 32 s : **6 588 réussites**, un scénario Échecs ignoré par le filtre existant `@en-cours`, zéro échec/erreur. Contrats fournisseur, tests Docker, Checkstyle, Spotless et seuils JaCoCo passent. Aucun BANG ! ignoré. |

Les logs de cette revue sont conservés sous
`frontend/node_modules/.cache/bang-61-lectures-*.log` : rouges/verts, `e2e-final`,
`front-targeted`, `format`, `format-check`, `lint`, `typecheck`, `test-coverage`,
`test-contract`, `build` et `clean-verify`.
JaCoCo reste à 99,03 % des lignes et 94,88 % des branches ; son XML est conservé
dans `bang-61-lectures-jacoco.xml`. Le JAR ne contient aucune classe `BangBrowser`.

### Limites et remise

Le correctif ne change ni le protocole ni les règles du moteur et ne rajoute
aucune temporisation. Les garanties de score restent celles des parcours et
frontières déjà testés : aucun envoi/file de score invité ou local observé et
refus HTTP de score invité. La fin de partie, le barème et la publication d'un
résultat BANG ! validé restent à raccorder ; ce n'est pas une preuve de classement
final. La partie locale reste en mémoire pendant la navigation entre modes.

Après le dernier `git fetch origin --prune`, les deux contrôles d'ascendance
réussissent encore :

```powershell
git merge-base --is-ancestor origin/dev game/bang/61-demo-quatre
git merge-base --is-ancestor origin/game/bang/implementation game/bang/61-demo-quatre
```

`origin/dev` reste à `ece3ce79` et la branche commune distante à `22a11fc1`.
Le SHA testé est **`bd1e77cf362a2b97ede981873f23b0599e75acc3`** : correctif
`953cfd5`, puis intégration de la septième régression et des comptes de test.
Seul ce bilan documentaire est ajouté ensuite. Les commits restent locaux sur
`game/bang/61-demo-quatre` ; aucun push, aucune PR ni fusion vers la branche
commune, `dev` ou `main`.

## Revue de `428e0cbf` — double clic et fin après défausse

### Base et rouges réellement observés (5 novembre 2026)

La branche active est bien `game/bang/61-demo-quatre`, tête initiale `428e0cbf`,
sans changement local. Après `git fetch origin --prune`, `origin/dev` (`ece3ce79`)
et `origin/game/bang/implementation` (`22a11fc1`) sont déjà des ancêtres ; aucun
merge supplémentaire n'est nécessaire.

Le scénario fourni dans `controle-61-428e0cbf-4rshhxop/frontend/e2e-real/` est
repris tel quel dans `frontend/e2e-real/revue-geste.spec.ts`, ajouté à la suite
habituelle, puis exécuté **avant toute modification de production** :

```powershell
npm run test:e2e:bang -- --grep "un double clic garde"
```

Rouge métier : **2 POST `/turn/end`**, réponses **204 puis 409**, siège 1 en
DISCARD et alerte « Tu dois encore te défausser. ». Le rapport du vrai geste
Chromium contient les détails de clic `[1, 2]` et montre la lecture PLAY périmée
livrée après le premier 204, avant le second clic. Le vrai `dblclick({ delay: 180 })`
et les points de synchronisation de la reproduction sont conservés. L'intervalle
observé des événements dans ce rouge est de 371 ms ; aucune temporisation n'est
ajoutée au code de production.

Le test intérieur traverse le vrai `OnlineTable`, le plateau et le client API.
Seuls fetch et l'horloge sont contrôlés. La lecture périodique obtient PLAY
pendant le premier POST, puis sa réponse est retenue jusqu'à l'acceptation de la
fin. Le second clic arrive après cette lecture, avant la vue DISCARD suivante.
Rouge : **2 POST au lieu de 1**. Une deuxième variante livre aussi DISCARD avant
le second clic : elle expose le même doublon alors que sept cartes dépassent
encore les cinq PV.

### Correctif et verts

`3aa4104` modifie uniquement l'envoi depuis `OnlineTable` :

- Après une fin acceptée, les numéros des lectures déjà lancées deviennent la
  borne à dépasser. Leurs anciennes vues PLAY ne peuvent plus libérer le verrou
  ni réautoriser la même fin. La pioche conserve sa borne de début de commande :
  les trois ordres du premier clic valide restent couverts.
- En DISCARD, tant que la main dépasse les PV lus dans la vue du joueur, aucune
  nouvelle fin n'est envoyée. Dès que la main respecte cette limite, le bouton
  peut envoyer la fin suivante. Le serveur reste responsable des règles.

Vert du même vrai double clic : **1 POST**, réponses **[204]**, siège 1 en
**DISCARD**, aucune alerte. L'intervalle mesuré de ce rejeu isolé est de 383 ms.
Les 34 tests de `OnlineTable` passent, y compris tous les clics simples précédents,
les anciennes réponses et les intentions devenues invalides. Aucune alerte n'est
masquée pour obtenir le vert : le test compte les requêtes réellement envoyées.

Le parcours est prolongé, dans le composant et le vrai navigateur : deux cartes
sont défaussées (7 → 6 → 5), puis un nouveau clic valide envoie la deuxième fin,
reçoit 204 et passe au siège 2 en DRAW, toujours sans alerte. Les métriques du
geste sont attachées avant cette continuation : **un POST pour le double clic**,
puis **un autre POST légitime après défausse**, soit `[204, 204]` au total.

La fixture de test propose six créateurs pour les six tables indépendantes de
la suite. Le nouveau scénario utilise les comptes 6, 1, 2, 4 ; chaque table reste
à quatre joueurs. Les identités supplémentaires sont dans `src/test`, sous le
profil `bang-browser`. La donne, les cartes, les personnages et le moteur de
Colleen ne sont pas modifiés. Le typage du contrôle de tick fourni est adapté au
`Window` DOM pour TypeScript, sans changer le callback, le geste ou son ordre.

### Huit parcours sur le SHA corrigé

SHA testé : **`d6e7666cffbed260d3baafa9a3b2cca35193c954`**. Il contient le correctif
`3aa4104` et l'intégration du huitième scénario. La commande habituelle
`npm run test:e2e:bang` réussit : **8 scénarios ensemble, zéro retry, 1,5 min**,
Chromium et vrai serveur Spring. Elle est exécutée dans un terminal persistant
(PTY), sans changement des gestes, des attentes ou de la configuration des retries.

Racine des artefacts :
`D:\COURS\SDV_2026_2027\tiki-gaming\frontend\test-results\`.

| Scénario vert | Sous-répertoire contenant `trace.zip` |
| --- | --- |
| Quatre comptes : catalogue, tirs, esquive, reconnexion, bonus Bart et joueur suivant | `bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium` |
| Deux comptes / deux invités : sièges distincts, confidentialité, tirs et reprises | `review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium` |
| Quatre joueurs sur le même écran : tirs, réponses et passages privés | `review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium` |
| Partie locale conservée après changement de mode | `controle-limites-un-détour-a85ee-la-partie-sur-le-même-écran-chromium` |
| Premier clic valide pendant la réponse de pioche | `review.probe-un-seul-clic--88735-nse-du-POST-de-pioche-tarde-chromium` |
| Premier clic valide après le 204, PLAY déjà affiché | `controle-limites-le-clic-e-42f94-lle-lecture-termine-le-tour-chromium` |
| Premier clic valide quand la première lecture PLAY est livrée après le 204 | `revue-lectures-un-clic-res-b922a-4-affiche-PLAY-après-le-204-chromium` |
| Vrai double clic : un POST, puis fin suivante après les deux défausses | `revue-geste-un-double-clic-b2cb2-imée-arrive-entre-les-clics-chromium` |

La nouvelle trace contient `geste-et-commandes` (un POST et `[204]`, aucune alerte)
et `fin-apres-defausse` (deux POST au total et `[204, 204]`, siège 2 en DRAW,
cinq cartes restantes). Les captures des quatre places des scénarios comptes,
mixte et local sont conservées dans leurs dossiers respectifs. Les contrôles
existants d'un seul siège Shérif, de mains/rôles privés et d'absence de score
invité/local pendant ces parcours restent verts.

Le rouge navigateur et sa trace sont conservés dans
`frontend/node_modules/.cache/bang-61-geste-acceptance-red.log` et
`bang-61-geste-acceptance-red/trace.zip`. Le rouge et le vert intérieurs sont dans
`bang-61-geste-component-red.log` et `bang-61-geste-component-green.log`.
Le rejeu collectif final et son SHA figurent dans `bang-61-geste-e2e-final.log`
et `bang-61-geste-tested-sha.txt`.

Plusieurs lancements hors PTY ont rencontré une coupure de serveur et des
fermetures de contexte navigateur : `ECONNRESET`, puis `ERR_CONNECTION_REFUSED`,
ou échec d'une lecture pendant la fermeture du navigateur. Ils ne sont pas comptés
comme des rouges métier. Les sorties sont gardées dans les fichiers
`bang-61-geste-e2e-infrastructure*.log`, `bang-61-geste-webserver-diagnostic.log`
et `bang-61-geste-e2e-ci-check.log`. La cause de ces fermetures n'est pas établie ;
le passage en mode CI seul ne les a pas supprimées. Aucun contournement CI,
augmentation de délai ou retry n'est ajouté au dépôt. Le rejeu normal en terminal
persistant passe les huit scénarios sur le SHA ci-dessus.

### Contrôles de cette revue

| Commande exécutée | Résultat |
| --- | --- |
| `npm run test:e2e:bang -- --grep "un double clic garde"` avant le code de production | Rouge : deux POST, `[204, 409]`, alerte de défausse. |
| Même commande après le correctif | Vert : un POST, `[204]`, DISCARD et aucune alerte. |
| Même scénario prolongé après deux défausses | Nouvelle fin valide : 204, siège 2 en DRAW ; deux POST au total sur les deux fins distinctes. |
| `npm test -- src/games/bang/OnlineTable.test.tsx` | **34 réussites** ; double clic avec lecture PLAY périmée ou DISCARD fraîche entre les clics, puis fin après défausse. Les clics simples et autres garde-fous existants restent verts. |
| `npm test -- src/games/bang` | **219 réussites**, 11 fichiers. |
| `npm run test:e2e:bang` sur `d6e7666c` | **8 réussites ensemble**, vrai Spring, Chromium, zéro retry ; 1,5 min avec les serveurs. |
| `npm run format`, `npm run format:check`, `npm run lint`, `npm run typecheck` | Succès. |
| `npm run test:coverage` | **1 523 réussites**, 125 fichiers ; lignes 93,86 %, branches 87,77 %, fonctions 91,86 %, instructions 92,67 %. Tous les seuils passent. |
| `npm run test:contract` | **11 interactions réussies**, Pact régénéré sans différence de contenu. |
| `npm run build` | Succès ; avertissement existant sur la taille des chunks conservé. |
| `npm run rtm:check`, `npm run db:check` | Traçabilité complète : 24 exigences, 85 cas ; 17 migrations uniques. |
| `mvn -B -ntp spotless:apply '-Dtest=BangBrowserIsolationTest' test` | Succès : fixture de comptes absente du contexte normal. |
| `mvn -B -ntp clean verify` dans `backend/` | **BUILD SUCCESS** en 1 min 25 s : **6 588 réussites**, un scénario Échecs ignoré par le filtre existant `@en-cours`, zéro échec/erreur. Aucun BANG ! ignoré ; contrats fournisseur, tests Docker, Checkstyle, Spotless et seuils JaCoCo passent. |

Sorties conservées dans `frontend/node_modules/.cache/bang-61-geste-*.log`,
notamment `front-targeted`, `format`, `format-check`, `lint`, `typecheck`,
`test-coverage`, `test-contract`, `build`, `fixture`, `clean-verify` et `e2e-final`.
JaCoCo : lignes 99,03 %, branches 94,88 %. Son XML est également conservé dans
`frontend/node_modules/.cache/bang-61-geste-jacoco.xml`. Le JAR ne contient aucune
classe de fixture `BangBrowser`.

### Limites conservées

Le correctif ne touche pas aux règles du moteur ni au protocole des actions.
La partie locale reste conservée uniquement en mémoire pendant la navigation
entre modes. Les limites de victoire, de barème et de publication d'un résultat
BANG ! final validé, décrites dans les bilans précédents, restent à raccorder ;
l'absence d'envoi de score pendant les tours n'est pas une preuve de fin de partie.
L'instabilité de certains lancements hors PTY est documentée ci-dessus ; sa cause
n'est pas attribuée au correctif de clic.

### Remise pour revue

Après le dernier `git fetch origin --prune`, les deux commandes réussissent :

```powershell
git merge-base --is-ancestor origin/dev game/bang/61-demo-quatre
git merge-base --is-ancestor origin/game/bang/implementation game/bang/61-demo-quatre
```

Les références restent `ece3ce79` et `22a11fc1`. Le SHA testé est
**`d6e7666cffbed260d3baafa9a3b2cca35193c954`**, après le correctif `3aa4104` et
l'intégration du huitième scénario. Seul le présent bilan documentaire est ajouté
ensuite. Les commits restent locaux sur `game/bang/61-demo-quatre` : aucun push,
aucune PR, aucun merge vers la branche commune, `dev` ou `main`.

## Revue de `c7a55ac2` — premier clic de défausse (5 novembre 2026)

### Base et rouges réellement observés

La tête initiale est `c7a55ac202a3f0d58e8305b4bc41059fa30dcec9`, sur la branche
existante `game/bang/61-demo-quatre`, sans changement local. Après le fetch,
`origin/dev` (`ece3ce79`) et `origin/game/bang/implementation` (`22a11fc1`)
sont déjà des ancêtres ; aucune intégration supplémentaire n'est nécessaire.

Le scénario fourni dans
`revue-61-c7a55ac2-86ptz833/frontend/e2e-real/controle-premiere-defausse.spec.ts`
est copié dans `frontend/e2e-real/` et ajouté à la configuration habituelle.
Avant toute modification du code de production :

```powershell
npm run test:e2e:bang -- --grep "le premier clic sur une carte"
```

Rouge métier observé avec le vrai serveur : Spring accepte la fin, une lecture
affiche DISCARD et les cartes deviennent sélectionnables. Le navigateur reçoit
ensuite le 204 de fin ; la lecture déclenchée par cet acquittement est retenue.
Un seul clic sur la première carte, puis la libération de cette lecture donnent
**zéro POST de défausse**, **sept cartes**, la carte choisie toujours en main,
siège 1 en **DISCARD**, sans alerte. La panne n'est pas un défaut de serveur.

Le test intérieur reproduit ensuite cet ordre dans le vrai `OnlineTable`, avec
le plateau et le client API réels. Seuls fetch et l'horloge sont contrôlés.
Deux choix de carte (indices 0 et 3) exposent le même rouge : **zéro commande au
lieu d'une**, avant de modifier `OnlineTable.tsx` :

```powershell
npm test -- src/games/bang/OnlineTable.test.tsx -t "le premier clic défausse"
```

### Correctif et verts

Le commit `fb8de8a2` conserve la borne d'acquittement qui protège d'une ancienne
vue PLAY après une fin déjà acceptée. Il ne déplace cette borne de commande que
si le joueur actif et la phase affichés sont restés les mêmes. Si une lecture
a déjà appliqué DISCARD pendant le POST de fin, son acquittement peut libérer
le verrou pour la défausse autorisée. Les lectures en vol à l'acquittement
restent invalidées afin de ne pas faire reculer la vue.

Le nouveau clic n'est pas différé : le client envoie directement l'identifiant
reçu du bouton de carte. Les deux variantes intérieures vérifient l'URL choisie,
le POST unique, la main à six, l'absence de la carte choisie, DISCARD et aucune
alerte. L'ancienne réponse de lecture retenue, livrée en dernier, ne rétablit
pas les sept cartes. **Les 36 tests du composant passent**, dont les clics simples autour de
la pioche, les doubles clics et l'abandon des intentions devenues invalides.

Le premier rejeu navigateur après ce correctif constate déjà un POST et six
cartes, mais expose une course dans l'observation du test : la lecture serveur
peut précéder la collecte du 204 par le listener. Le test attend désormais
la réponse exacte du POST de la carte choisie avant d'asserter ses codes.
Aucun délai, second clic ou changement de l'ordre imposé n'est ajouté.
Le même parcours passe alors au vert.

Le commit `44017b4` intègre ce scénario à la suite habituelle, avec le créateur
distinct **bang7** (puis les comptes 1, 2, 4). La fixture de connexion propose
sept créateurs pour les sept tables indépendantes ; elle reste sous `src/test`
et le profil `bang-browser`, avec AuthController, sessions et CSRF réels.
Le moteur, la donne, les cartes et les personnages de Colleen sont conservés.
Le seul fichier de production modifié par cette revue est `OnlineTable.tsx`.

Le parcours est prolongé jusqu'au tour suivant :

- Premier clic : **1 POST `/turn/discard/BANG-21`**, **204**, main **7 → 6**,
  BANG-21 absente, siège 1 en DISCARD, aucune alerte.
- Deuxième clic : **1 POST `/turn/discard/BANG-22`**, **204**, main **6 → 5**,
  BANG-22 absente aussi, toujours DISCARD.
- Nouvelle fin valide : **204**, siège **2**, phase **DRAW**, cinq cartes
  conservées par le premier joueur. Deux fins distinctes ont été envoyées
  sur l'ensemble de ce parcours, une avant et une après les défausses.

### Neuf parcours ensemble sur le code corrigé

SHA testé : **`44017b473dc517c4c7518bfe59eddef190f7bf9b`**.
`npm run test:e2e:bang` réussit avec **9 scénarios ensemble, zéro retry, 1,7 min**,
Chromium et vrai Spring, dans un terminal persistant (PTY).

Racine des artefacts du dépôt : `frontend/test-results/`. Chaque dossier du
tableau contient son `trace.zip`. Une copie durable des **neuf traces et vingt
captures** est également conservée sous `neuf-parcours/` dans :

```text
C:\Users\antoi\.codex\visualizations\2026\11\04\01a1a8ce-2f13-7760-87ef-6ae22e0c83f0\bang-61-premiere-defausse-44017b4\
```

| Scénario vert | Dossier de trace |
| --- | --- |
| Quatre comptes : catalogue, tir, esquive, reconnexion, acceptation, Bart et tour suivant | `bang-du-catalogue-au-tour--4da0a-acceptation-et-vues-privées-chromium` |
| Deux comptes et deux invités : sièges distincts, tirs, confidentialité et reprises | `review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium` |
| Quatre joueurs sur un écran : tirs et réponses avec passages privés | `review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium` |
| Partie locale conservée après changement de mode, y compris pendant un passage d'écran | `controle-limites-un-détour-a85ee-la-partie-sur-le-même-écran-chromium` |
| Premier clic de fin pendant la réponse du POST de pioche | `review.probe-un-seul-clic--88735-nse-du-POST-de-pioche-tarde-chromium` |
| Premier clic de fin après le 204, PLAY déjà affiché | `controle-limites-le-clic-e-42f94-lle-lecture-termine-le-tour-chromium` |
| Premier clic de fin quand la première vue PLAY arrive après le 204 | `revue-lectures-un-clic-res-b922a-4-affiche-PLAY-après-le-204-chromium` |
| Vrai double clic, ancienne vue PLAY entre les clics, puis fin après défausses | `revue-geste-un-double-clic-b2cb2-imée-arrive-entre-les-clics-chromium` |
| Premier clic de défausse pendant la relecture de fin, puis 7 → 6 → 5 et siège 2 | `controle-premiere-defausse-20051-cture-de-fin-de-tour-attend-chromium` |

L'attachment `premiere-defausse` contient l'identifiant choisi, le chemin exact,
un POST, `[204]`, six cartes, DISCARD et aucune alerte. `suite-apres-defausse`
confirme les deux défausses, `[204, 204]`, puis le siège 2 en DRAW.
Les rapports JSON sont aussi extraits dans `preuves/` dans l'archive ci-dessus.

Le vrai double clic conserve les événements `[1, 2]`, avec la lecture PLAY
périmée entre les deux clics : **un seul POST**, **[204]**, DISCARD, aucune
alerte (intervalle mesuré 372 ms). La fin suivante après défausse reste possible.
Les trois ordres de réponse autour de la pioche restent verts, sans second clic.

Les quatre vues en ligne désignent **le même et unique siège Shérif : 1**.
Le contrôle porte sur les sièges distincts, y compris quand le tapis local est
réorienté. Les rôles privés sont Shérif, Hors-la-loi, Hors-la-loi, Renégat.
Les assertions de confidentialité du JSON et de l'écran restent vertes pour
les comptes et invités ; seuls la propre main et le propre rôle privé sont reçus.
Le tir, Raté !, l'acceptation, le bonus de Bart, les reprises des invités et les
passages privés locaux sont rejoués. Aucun score invité ou local n'est envoyé
ou mis en attente pendant ces parcours.

Le rouge initial et sa trace sont conservés dans
`frontend/node_modules/.cache/bang-61-defausse-acceptance-red.log` et
`bang-61-defausse-acceptance-red/trace.zip`, avec une copie dans `rouge/`
de l'archive. Les logs intérieurs sont `bang-61-defausse-component-red.log`
et `bang-61-defausse-component-green.log`. Le rejeu collectif et son SHA sont
dans `bang-61-defausse-e2e-final.log` et `bang-61-defausse-tested-sha.txt`.

### Contrôles exécutés sur cette revue

| Commande | Résultat |
| --- | --- |
| `npm run test:e2e:bang -- --grep "le premier clic sur une carte"`, avant le code de production | Rouge métier : zéro défausse, sept cartes et carte choisie conservée en DISCARD. |
| `npm test -- src/games/bang/OnlineTable.test.tsx -t "le premier clic défausse"`, avant le code de production | Deux rouges : zéro POST au lieu d'un pour les cartes d'indices 0 et 3. |
| `npm test -- src/games/bang/OnlineTable.test.tsx`, après le correctif | **36 réussites**, dont les deux nouvelles variantes et tous les garde-fous précédents. |
| Même commande navigateur après le correctif, puis avec la continuation | Vert : un POST de la carte choisie, 204, six cartes ; ensuite cinq cartes et siège 2 en DRAW. |
| `npm test -- src/games/bang` | **221 réussites**, 11 fichiers. |
| `npm run test:e2e:bang` sur `44017b4` | **9 réussites ensemble**, Chromium, vrai Spring, aucun retry ; 1,7 min avec les serveurs. |
| `npm run format`, `npm run format:check`, `npm run lint`, `npm run typecheck` | Succès. |
| `npm run test:coverage` | **1 525 réussites**, 125 fichiers ; lignes 93,86 %, branches 87,78 %, fonctions 91,86 %, instructions 92,67 %. Seuils respectés. |
| `npm run test:contract` | **11 réussites** ; Pact régénéré sans différence de contenu. |
| `npm run build` | Succès ; avertissement existant sur la taille des chunks. |
| `npm run rtm:check`, `npm run db:check` | Traçabilité complète : 24 exigences, 85 cas (84 PASSED), 5 anomalies ; 17 migrations uniques. |
| `mvn -B -ntp spotless:apply '-Dtest=BangBrowserIsolationTest' test` | Succès ; fixture de démo absente du contexte normal. |
| `mvn -B -ntp clean verify` dans `backend/` | **BUILD SUCCESS**, 1 min 32 s : **6 588 réussites**, un scénario Échecs ignoré par le filtre existant `@en-cours`, zéro échec/erreur. Aucun BANG ! ignoré. Contrats fournisseur, Docker, Checkstyle, Spotless et seuils JaCoCo verts. |

JaCoCo : lignes **99,03 %**, branches **94,88 %**. Le JAR produit ne contient
aucune classe `BangBrowser`. Les sorties sont dans
`frontend/node_modules/.cache/bang-61-defausse-*.log`, notamment `front-targeted`,
`format`, `format-check`, `lint`, `typecheck`, `test-coverage`, `test-contract`,
`build`, `fixture`, `clean-verify` et `ancestry`. Le XML JaCoCo est conservé dans
`bang-61-defausse-jacoco.xml`. Une copie des contrôles, du SHA et de ce XML figure
dans `controles/` dans l'archive de la revue.

### Limites et remise pour revue

Le correctif ne modifie ni les cartes, ni les personnages, ni les règles du
moteur. La partie locale reste conservée en mémoire pendant la navigation,
sans persistance après redémarrage. L'absence d'envoi/file de score invité ou
local pendant ces tours est vérifiée ; la fin de partie, le barème et la
publication d'un résultat BANG ! final validé restent à raccorder. Ces parcours
ne constituent donc pas une preuve de score de fin de partie.

Après le dernier `git fetch origin`, les contrôles portent sur le **SHA testé** :

```powershell
git merge-base --is-ancestor origin/dev 44017b473dc517c4c7518bfe59eddef190f7bf9b
git merge-base --is-ancestor origin/game/bang/implementation 44017b473dc517c4c7518bfe59eddef190f7bf9b
```

Les deux réussissent. `origin/dev` reste à `ece3ce79`, et
`origin/game/bang/implementation` à `22a11fc1`. Le code et les tests validés sont
dans `fb8de8a2`, puis `44017b4`. Seul ce bilan documentaire est ajouté ensuite.
Les commits restent locaux sur `game/bang/61-demo-quatre` ; aucun push, aucune
PR, aucun merge vers la branche commune, `dev` ou `main`.
