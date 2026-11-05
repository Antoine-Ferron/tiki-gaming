# BANG! — Catalogue et démo réelle à quatre (#61)

Validation initiale locale du 5 novembre 2026 ; la revue corrective est consignée
dans la dernière section. Les issues GitHub #60 et #61 restent ouvertes
pour validation ; les changements sont enregistrés dans des commits locaux.

État courant après la revue de `109a2990` : les choix « Sur le même écran » et
« En ligne » sont accessibles avec ou sans compte. Les invités en ligne ont une
place liée à leur session HTTP. Les trois régressions de cette revue sont reprises
dans la suite habituelle ; le bilan détaillé figure en fin de document. Les
sections de validation précédentes conservent leurs résultats historiques.

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
