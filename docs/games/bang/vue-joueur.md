# BANG! — Vue d'une partie

`GET /api/games/bang/tables/{code}/state` renvoie la vue du compte connecté à la session HTTP.
Le client ne fournit ni identifiant de compte ni place pour choisir la vue. La casse et les espaces
autour du code de table sont ignorés ; le code renvoyé est sa forme canonique.

La réponse `200` est un objet JSON :

| Champ | Contenu |
| --- | --- |
| `code` | Code de la table. |
| `seat` | Place du compte connecté, de 1 à 4. |
| `currentSeat` | Place du joueur actif. Au démarrage, c'est celle du Shérif. |
| `phase` | Phase conservée par le serveur : `DRAW` (piocher), `PLAY` (jouer) ou `DISCARD` (se défausser). Au démarrage : `DRAW`. |
| `role` | Rôle privé du compte connecté : `SHERIFF`, `OUTLAW` ou `RENEGADE`. |
| `hand` | Sa main : tableau d'objets `{ "id": "…", "type": "BANG" }`, le type pouvant aussi être `MISSED`. |
| `players` | Joueurs dans l'ordre des places. |
| `pendingShot` | Présent uniquement lorsqu'un tir attend sa cible : `{ "id": "…", "shooterSeat": 1, "targetSeat": 2 }`. Absent après résolution. Conservé à la reconnexion du même compte tant que la table existe. |

Chaque joueur de `players` possède les champs `seat`, `character`, `health`, `maxHealth`,
`playedCards` et `handCount`. `character` est l'identifiant du personnage ; `health` et `maxHealth`
sont ses PV actuels et maximaux. `playedCards` est toujours vide à ce stade. Seul le Shérif a un
champ supplémentaire `role`, dont la valeur est `SHERIFF` ; ce champ est absent chez les autres.

Les rôles et objectifs secrets des adversaires, leurs cartes en main, ainsi que le contenu et l'ordre
de la pioche ne figurent pas dans la réponse. Une nouvelle session du même compte retrouve la même
vue. Les lectures ne modifient pas la donne, ne retournent pas les cartes Rôle et ne font pas avancer
le tour.

| Statut | Situation |
| --- | --- |
| `401` | Aucune session authentifiée. |
| `403` | Le compte n'est pas assis à cette table, même si la partie n'a pas commencé. |
| `404` | Table inconnue ou expirée. |
| `409` | Le compte est assis, mais la partie n'a pas encore démarré. |

Les erreurs utilisent le format commun `{ "error": "message" }`. Une table expire une heure après
sa création, une jonction acceptée, un démarrage accepté ou une action de tour acceptée. Consulter
une vue ou envoyer une action refusée ne renouvelle pas ce délai.

Les commandes et transitions sont décrites dans [Déroulement des tours](deroulement-tours.md).
Les actions et conflits de tir sont décrits dans [Synchronisation des tirs](synchronisation-tirs.md).
