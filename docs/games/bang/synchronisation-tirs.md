# BANG! — Synchronisation des tirs (#59)

Implémentation de l'[issue #59](https://github.com/EAnathos/tiki-gaming/issues/59),
depuis `game/bang/implementation` contenant la #58 et `origin/dev` à `41d1b41`.

## Actions HTTP et reprise

Préfixe : `/api/games/bang/tables/{code}`. Les actions sont des `POST` sans corps JSON,
authentifiés par la session existante et protégés par le CSRF existant (cookie `XSRF-TOKEN`,
en-tête `X-XSRF-TOKEN`, obtenus via `GET /api/auth/session`). Un compte ou siège ajouté à
la requête ne remplace jamais l'identité de session. La casse et les espaces extérieurs du code
sont ignorés.

| Route | Action |
| --- | --- |
| `/shots/{cardId}/targets/{targetSeat}` | En `PLAY`, le joueur actif joue une carte autorisée par son personnage sur une cible vivante à portée. La carte quitte sa main, rejoint la défausse et un unique tir en attente est créé. |
| `/shots/{shotId}/dodge/{cardId}` | Seul le compte cible peut jouer une esquive autorisée pour **ce tir**. Sa carte rejoint la défausse ; ses PV sont conservés. |
| `/shots/{shotId}/accept` | Seul le compte cible peut accepter **ce tir**, sans carte : les règles retirent 1 PV, sans descendre sous zéro. |

Un succès renvoie `204` sans corps. Lire ensuite `GET …/state` avec sa session pour récupérer
sa [vue privée](vue-joueur.md). Pendant l'attente, elle contient ce fragment public :

```json
{
  "currentSeat": 1,
  "phase": "PLAY",
  "pendingShot": {
    "id": "identifiant-unique-du-tir",
    "shooterSeat": 1,
    "targetSeat": 2
  }
}
```

Le tireur ne peut plus tirer, terminer son tour, piocher ou défausser pendant l'attente.
La cible peut répondre bien que `currentSeat` reste celui du tireur. Après résolution,
`pendingShot` est **absent**, et le tireur poursuit sa phase `PLAY`.

Une actualisation ou une nouvelle session du même compte retrouve sa main et le même
`pendingShot.id` : ils appartiennent à la table serveur. Il suffit de consulter l'état ;
appeler `/join` ou `/start` n'est pas nécessaire. Leur répétition conserve la partie,
le compteur de tirs, le tour et l'attente. Les autres mains et rôles secrets ne sont jamais
transmis, et aucune route ne retourne directement `GameState`.

| Statut | Situation |
| --- | --- |
| `401` | Session non authentifiée (avec un CSRF valide). |
| `400` | Le siège cible n'est pas un entier 32 bits. Un entier représentant un siège invalide relève de `409`. |
| `403` | CSRF absent/invalide, compte extérieur, tireur non actif ou réponse d'un autre compte que la cible du tir courant. |
| `404` | Table inconnue ou expirée. |
| `409` | Partie non démarrée ; tir hors phase, déjà en attente, au-delà de la limite du tour, cible invalide/hors portée ou carte indisponible ; réponse sans attente, avec un identifiant périmé ou une carte non autorisée. |

Les refus métier utilisent `{ "error": "message" }`. Les refus CSRF conservent le format
du serveur embarqué (`timestamp`, `status`, `error`, `path` avec `Accept: application/json`),
vérifié en vrai HTTP et décrit dans Swagger. `BangCard` et les schémas des autres jeux sont conservés.

## Atomicité, doublons et durée de vie

Validation, règles, remplacement de l'état, ajout à la défausse, compteur et attente sont
exécutés sous le même verrou existant. Une action refusée laisse l'état inchangé.
Les deux éléments de `ShotOutcome` sont appliqués une seule fois : son nouvel état et
ses cartes à ajouter à la défausse, sans perdre la défausse précédente, la pioche ou les autres mains.

Deux tirs concurrents, même de Willy avec deux cartes différentes, n'ouvrent qu'une attente.
Deux réponses concurrentes, y compris une esquive contre une acceptation, ne résolvent le tir
qu'une fois. Une carte déjà jouée n'est plus disponible ; une réponse répétée ou ancienne
reçoit `409` sans second effet. Chaque réponse doit fournir l'identifiant lu dans l'attente :
celui d'un ancien tir ne peut jamais résoudre le suivant de Willy. Le serveur conserve seulement
l'attente courante et le compteur du tour, sans historique de commandes.

Le compteur est incrémenté après chaque tir accepté, conservé après résolution et remis à zéro
uniquement au passage à un nouveau tour (pas à l'entrée en défausse). Les lectures,
reconnexions et démarrages répétés ne le réinitialisent pas.

La table expire après une heure sans activité acceptée. Un nouveau tir ou une réponse acceptée
renouvelle l'activité ; lecture, refus, doublon et réponse périmée ne la prolongent pas.
Les opérations historiques de création/jonction/démarrage/tour gardent leur fonctionnement.
À l'expiration, table, mains, compteur et attente disparaissent.

## Moteur, pouvoirs et limites

Le service utilise `ShotRules.fire` et `ShotRules.respond`. À chaque action, il reconstruit le
raccordement de distance avec **l'état courant**, via `PlayerDistance.between`. Une élimination
change donc la portée du tir suivant. `ShotRules` applique `BangCharacter.distanceAsTarget`,
sans déplacer ce pouvoir dans le service.

Les contrats de Colleen sont utilisés pour les substitutions de Calamity Janet, sa limite
de tirs, l'exception de Willy et le modificateur de Paul Regret. Les dégâts restent ceux
de `ShotRules.respond`.

**Pouvoir non raccordé : Bart Cassidy.** Son contrat `cardsDrawnOnLifeLost` est conservé
inchangé, mais `ShotRules.respond` ne l'appelle pas : accepter un tir lui retire 1 PV sans
piocher sa carte de pouvoir. La #59 ne réécrit pas ce travail. Le recyclage de la défausse,
les autres cartes/armes et la victoire ne sont pas ajoutés ici.

Le stockage est en mémoire, limité à la durée de vie du serveur. La survie au redémarrage,
le plateau et la démonstration dans quatre navigateurs restent hors périmètre. Les joueurs
doivent relire l'état ; aucun mécanisme de notification temps réel n'est ajouté dans cette étape.

## Journal TDD outside-in

Les tests HTTP utilisent Spring MVC et la sécurité réelle. La distribution initiale est un double
contrôlable qui fournit des records de domaine réels ; `ShotRules` et `PlayerDistance` restent réels.
Le test du contrôleur simule son service pour vérifier la collaboration et l'identité de session.
Ces tests HTTP ne sont pas des E2E navigateur.

| Étape | Rouge observé avant le code | Vert stabilisé |
| --- | --- | --- |
| Consommer une carte et publier un tir en attente | HTTP : `204` attendu, `404` reçu. Contrôleur : appel `fire` attendu mais absent. Service : main attendue vide, BANG! encore présent. | 13 tests (HTTP, contrôleur, service, projection privée), commit `ffcc0d6`. |
| Verrouiller les actions du tireur pendant l'attente | Second tir : `409` attendu, `204` reçu. | 14 tests ciblés, dont les refus sans mutation de tirer, terminer, piocher et défausser. |
| Répondre par une esquive, depuis le compte cible | Esquive : `204` attendu, `404` reçu ; réponses par tireur, tiers ou extérieur : `403` attendu, `404` reçu. Identifiant périmé : `409` attendu, `404` reçu. | 20 tests ciblés ; PV conservés, défausse ajoutée, attente supprimée et tour repris. |
| Accepter le tir une seule fois | `204` attendu, `404` reçu sur l'acceptation. | 22 tests ciblés ; perte de 1 PV, carte d'esquive conservée, doublons acceptation/esquive en `409`. |
| Conserver le compteur à la reconnexion | Après réponse, lectures, jonctions et démarrages répétés : second BANG! en `204` au lieu de `409`. | 44 tests ciblés incluant les 21 contrats de `ShotRules`. |
| Réinitialiser le compteur au nouveau tour | Au retour au tireur après un tour de table : `204` attendu, `409` reçu. | 48 tests ciblés incluant les règles de tour. |
| Refuser les tirs hors phase | Deux phases (`DRAW`, `DISCARD`) : `409` attendu, `204` reçu. | 57 tests ciblés ; les refus hors tour, hors portée, cible invalide et carte indisponible étaient déjà verts avec les vrais composants. |
| Respecter Paul Regret comme cible | HTTP : `409` attendu, `204` reçu. Domaine : exception attendue mais absente. | 96 tests ciblés ; appel de `distanceAsTarget` dans `ShotRules`, sans duplication dans le service. |
| Documenter les actions et leur protection CSRF | 6 échecs : descriptions absentes et schémas `403` manquants face au JSON observé sur le serveur embarqué. | 48 tests HTTP/Swagger réussis ; 41 routes, `BangCard` et schémas des autres jeux conservés. |
| Refuser un siège cible mal formé | 3 requêtes (texte et débordements d'entier) : `400` attendu, `500` reçu. | 137 tests ciblés HTTP/moteur/Swagger réussis ; conversion locale au contrôleur BANG!, sans modification du gestionnaire des autres jeux. |

Le blocage initial du lanceur Java dans l'environnement restreint n'est pas compté comme rouge métier.

Les scénarios complémentaires Willy (réponse ancienne pendant un nouveau tir), Calamity, élimination
suivie d'un nouveau calcul de distance, deux tirs simultanés, deux réponses simultanées (acceptation,
esquive et concurrence des deux) et confidentialité des quatre vues sont déjà verts avec le
raccordement précédent : **104 tests ciblés**, sans ajouter de code de production ni fabriquer de rouge.
Les courses utilisent une `CyclicBarrier`, des sessions distinctes et des attentes bornées, sans sommeil.

Avec une horloge contrôlée, les tirs et réponses acceptés renouvellent l'activité ; lectures,
refus, secondes tentatives et doublons de réponses laissent expirer la table à l'heure exacte.
Authentification, CSRF et refus sur table inconnue/non démarrée sont couverts pour les trois routes.
**127 tests ciblés** passent, dont un parcours HTTP utilisant le vrai catalogue et la vraie distribution
(seul le mélange est reproductible), vérifiant que chaque carte existe exactement une fois.

## Intégration finale et vérifications

La récupération finale a apporté `origin/dev` de `41d1b41` à `0505d31` (configuration Docker/Coolify).
Intégration locale sans conflit dans `044c7f7`, uniquement sur la branche de la #59. Les neuf fichiers
de déploiement et documentation apportés par l'autre équipe sont conservés tels quels.
`origin/game/bang/implementation` reste à `94d09ff`.

Le 4 novembre 2026, depuis `backend/`, avec Java 25.0.3 et la cible de compilation Java 21 du dépôt :

| Vérification | Résultat local |
| --- | --- |
| `mvn -B -ntp '-Dtest=fr.tikigaming.games.bang.**,OpenApiDocsTest' test` | **323 tests réussis**, zéro échec, erreur ou test ignoré. |
| `mvn spotless:apply` | Succès, aucun fichier Java restant à reformater. |
| `mvn clean verify` | **1 441 tests réussis**, zéro échec, erreur ou test ignoré, y compris après l'intégration finale de `dev`. |
| Contrat fournisseur Pact, inclus dans `verify` | **6 interactions réussies**, aucune ignorée. |
| Chaos Toxiproxy/Docker, inclus dans `verify` | **4 tests réussis**, aucun ignoré. |
| Checkstyle, Spotless et JaCoCo | Succès ; couverture globale : **98,98 % des lignes**, **94,43 % des branches**, sans baisse des seuils. |
| `mvn -B -ntp -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage` | Succès : **243/250 mutants tués (97 %)**, aucun sans couverture. |
| `docker compose --env-file .env.production.example config --quiet`, à la racine | Succès, aucun service démarré. |

Pitest garde le périmètre existant du dépôt (authentification, dames et résilience) ;
les classes BANG! ne figurent pas dans ses cibles. Les 323 cas ciblés sont aussi inclus dans
les 1 441 tests rejoués après intégration. La nouvelle suite `GameShotHttpTest` comprend **53 cas**.

Les deux contrôles d'ascendance demandés passent sur la branche de travail :

```text
git merge-base --is-ancestor origin/dev HEAD
git merge-base --is-ancestor origin/game/bang/implementation HEAD
```

Les tests frontend, E2E navigateur, k6, ZAP, CodeQL, Sonar et les jobs GitHub ne sont pas exécutés
pour cette livraison locale. Aucun push, aucune intégration vers la branche commune et aucune
fermeture d'issue ne sont effectués. L'image Docker de production n'est pas construite ni déployée.

## Commits locaux de la #59

| Commit | Palier stabilisé |
| --- | --- |
| `ffcc0d6` | Tir en attente et application de `ShotOutcome`. |
| `e03b7d1` | Actions du tireur bloquées pendant l'attente. |
| `07fd2b4` | Esquive autorisée par le compte cible et identifiant du tir. |
| `aeafe44` | Acceptation des dégâts et refus des doublons. |
| `8d14c7e` | Compteur conservé dans la table et à la reconnexion. |
| `fc72fca` | Remise à zéro uniquement au nouveau tour. |
| `2e661b9` | Refus des tirs hors phase. |
| `93bc67d` | Raccordement du contrat de distance du personnage cible. |
| `dedff12` | Courses, réponses anciennes, élimination et vues privées. |
| `6879c0f` | Expiration contrôlée, sécurité HTTP et composants réels. |
| `3622177` | Documentation API, conflits, reprise et limites. |
| `f67f61d` | Validation HTTP du siège cible et normalisation des codes. |
| `044c7f7` | Intégration du dernier `dev` sur la branche de travail. |

Le commit documentaire final ajoute le présent bilan, sans modification supplémentaire du code.
