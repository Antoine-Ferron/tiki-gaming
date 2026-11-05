# BANG! — Catalogue et démo réelle à quatre (#61)

Validation initiale locale du 5 novembre 2026 ; la revue corrective est consignée
dans la dernière section. Les issues GitHub #60 et #61 restent ouvertes
pour validation ; les changements sont enregistrés dans des commits locaux.

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
