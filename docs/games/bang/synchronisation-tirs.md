# BANG! — Synchronisation des tirs (#59)

Implémentation de l'[issue #59](https://github.com/EAnathos/tiki-gaming/issues/59),
depuis `game/bang/implementation` contenant la #58 et `origin/dev` à `41d1b41`.

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
