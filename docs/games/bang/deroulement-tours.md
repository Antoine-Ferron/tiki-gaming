# BANG! — Déroulement des tours (#57)

Le serveur conserve le siège actif, la phase, les mains, la pioche et la défausse en mémoire.
Après la distribution initiale, le Shérif est actif en phase `DRAW`. Chacun a toujours reçu autant
de cartes que de PV : les deux cartes de début de tour attendent une commande explicite.

## Commandes HTTP

Préfixe : `/api/games/bang/tables/{code}`. Toutes les commandes sont des `POST` sans corps JSON.
L'identité vient exclusivement de la session serveur ; seul le compte du joueur actif peut agir.
Un jeton CSRF valide est requis (cookie `XSRF-TOKEN` et en-tête `X-XSRF-TOKEN`, obtenus via
`GET /api/auth/session`). Le code ignore la casse et les espaces extérieurs, comme pour la jonction.

| Route | Effet d'une commande acceptée |
| --- | --- |
| `/turn/draw` | En `DRAW`, prend les deux premières cartes de la pioche déjà mélangée, les ajoute à la main et passe en `PLAY`. |
| `/turn/end` | En `PLAY`, ouvre `DISCARD` si la main dépasse les **PV actuels** ; sinon, donne la main au prochain joueur vivant en `DRAW`. En `DISCARD`, termine le tour seulement lorsque la main respecte cette limite. |
| `/turn/discard/{cardId}` | En `DISCARD`, tant que la main dépasse les **PV actuels**, déplace exactement un exemplaire choisi de sa propre main vers la défausse. Dès que la limite est respectée, toute défausse supplémentaire est refusée. La phase reste `DISCARD` : il faut ensuite appeler `/turn/end`. |

Un succès renvoie `204`, sans corps. Consulter ensuite `GET …/state` pour obtenir sa
[vue privée](vue-joueur.md), dont `currentSeat`, `phase`, sa main et les nombres de cartes adverses.
Aucune commande ne retourne directement `GameState`.

| Statut d'erreur | Situation |
| --- | --- |
| `401` | Aucune session authentifiée. |
| `403` | Jeton CSRF absent ou invalide, compte extérieur à la table, ou joueur non actif. |
| `404` | Table inconnue ou expirée. |
| `409` | Partie non démarrée, transition incohérente, carte absente de sa propre main, défausse demandée alors que la main respecte déjà la limite de PV actuels, ou moins de deux cartes disponibles dans la pioche. |

Les refus métier utilisent `{ "error": "message" }`. Les refus CSRF gardent la réponse du serveur
embarqué documentée dans Swagger (`timestamp`, `status`, `error`, `path` avec `Accept: application/json`).
Les visiteurs n'accèdent pas aux informations de table ; un compte extérieur est refusé même si
la partie n'a pas encore commencé.

## Garanties

- La pioche est unique par tour. Une lecture, une actualisation, une nouvelle session du même compte
  ou un nouvel appel à `/start` conserve la phase et la main. Une seconde commande de pioche est refusée.
- On ne peut ni terminer avant de piocher, ni repiocher en `PLAY` ou `DISCARD`, ni défausser hors
  de `DISCARD`, ni terminer cette dernière phase avec une main trop grande.
- Une carte inconnue, adverse ou déjà défaussée est refusée sans modifier l'état.
- Le prochain siège vivant (PV strictement positifs) est choisi dans l'ordre circulaire des sièges.
  Les sièges éliminés sont sautés. Le nouveau tour commence en `DRAW`, sans pioche automatique.
- Validation et remplacement de l'état ont lieu sous le même verrou que les autres opérations de table.
  Deux commandes simultanées ne peuvent ni répéter une pioche ni défausser deux fois la même carte.
  Deux cartes distinctes acceptées sont toutes deux conservées dans la défausse, sans dépasser le surplus
  à retirer : s'il ne reste qu'une carte en trop, une seule des deux demandes est acceptée.
- La table expire après une heure sans création, jonction acceptée, démarrage accepté ou commande de
  tour acceptée. Les lectures et les commandes refusées ne prolongent pas ce délai.

## Modèle partagé et limites

`GameState` porte explicitement `phase` et `discardPile` dans son constructeur. Les reconstructions
de `ShotRules` conservent ces champs, ainsi que le siège actif et la pioche. Le contrat existant
`ShotOutcome.discarded` est conservé ; la résolution multijoueur des tirs relève de la #59.
Aucune action HTTP « jouer » n'est ajoutée dans cette issue.

Le recyclage de la défausse reste hors périmètre : avec zéro ou une carte disponible, `/turn/draw`
renvoie `409` et ne prélève aucune carte. Les distances, les tirs en attente, la victoire, le plateau,
le temps réel et la persistance après redémarrage restent dans leurs issues respectives.
