# API des rencontres — issue #18

## Périmètre et branche

`game/dame/api` est une branche distincte : la PR #116 des rencontres est encore
en review à sa création. Ses commits validés sont repris, puis le dernier `dev`
(`0001771`) est intégré par rebase. Aucun nouveau commit n'est poussé sur #116.
Après sa fusion en squash, seuls les commits API seront à reporter sur `dev`.
Cette étape livre le backend ; formulaire React et E2E viendront ensuite.

## Contrat HTTP

| Méthode | Route | Corps / réponse |
|---|---|---|
| POST | `/api/games/dame/matches` | `whiteName`, `blackName` → 201, état initial et Location |
| GET | `/api/games/dame/matches/{id}` | 200, état serveur de la rencontre de cette session |
| POST | `/api/games/dame/matches/{id}/moves` | `version`, `from: {row,column}`, `landings: [...]` → 200, nouvel état |

L'état renvoie l'UUID, les noms, une version (0 à la création), le plateau 10×10,
le camp au trait, le statut, les coups légaux, le gagnant et les dates. Le client
n'envoie jamais un plateau, un gagnant ou l'identifiant d'un propriétaire.

Les deux noms sont des noms d'affichage : aucun compte n'est requis pour cette
partie locale. Les POST héritent du CSRF de la plateforme ; le navigateur récupère
son jeton via le GET `/api/auth/session` déjà existant. Une autre session obtient
404, avant tout accès au dépôt, même si elle connaît l'UUID. Les JSON mal typés,
champs inconnus, coordonnées hors 0–9 et parcours de plus de 20 arrivées sont refusés.

## Cohérence et erreurs

- Une partie courante par session. Une nouvelle création remplace cette partie,
  sans effacer son ancienne rencontre en base ; une partie abandonnée reste en cours.
- La session conserve seulement un texte JSON produit côté serveur, sérialisable
  avec la session, jamais l'objet `Game` mutable ni un état fourni par le client.
- Les commandes de la même session sont sérialisées et exigent la version lue :
  une version périmée, une partie terminée ou une seconde commande concurrente
  reçoit 409. Un coup interdit reçoit 400 et ne modifie rien.
- Le coup est appliqué sur une copie. À la victoire, l'enregistrement précède le
  commit de session ; une panne du stockage renvoie 502 et conserve l'état initial.
- Si l'écriture a réussi mais sa réponse a été perdue, le même coup peut confirmer
  le résultat déjà enregistré avant de mettre à jour la session, sans seconde clôture.
- Pas de reprise après expiration de session ni de distribution multi-nœuds promise :
  le plateau n'est pas stocké en base. Les règles de nulle restent hors périmètre.

## Isolation et traçabilité

Sources et tests dans les packages Dames. Pas de nouvelle dépendance, migration,
modification du SDK, de Jackson global, de SecurityConfig ou de la CI. La seule
adaptation mécanique partagée sera le test Swagger : `dev` expose 35 routes,
les trois chemins Dames portent ce total à 38 et ajoutent le tag `dame`.
Cette exception est annoncée avant modification et sera signalée à la plateforme.

Sous-étapes avec commits distincts : contrats compilables, tests RED, logique
GREEN, puis tests Spring/CSRF et validations. Les commandes métier sont encore
squelettiques dans le premier commit ; aucune fonctionnalité terminée n'y est revendiquée.
