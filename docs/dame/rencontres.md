# Rencontres locales — issue #18

## Périmètre convenu le 4 novembre 2026

Avant les tests d'intégration, ajouter la gestion des rencontres en TDD unitaire :
enregistrer les noms des deux participants au démarrage, puis le résultat à la fin.
Ce sont des noms d'affichage ; aucune création de compte, IA ou partie réseau.
La reprise d'une partie et la sauvegarde du plateau restent hors de ce périmètre.

## Contrat métier

- Une rencontre possède un UUID, les noms des blancs et des noirs, une date de
  début, le statut du moteur et une date de fin facultative.
- Chaque nom est obligatoire, débarrassé des espaces de début et de fin, et
  contient de 1 à 50 unités UTF-16 après `String.strip()`. Les accents, espaces
  intérieurs et homonymes sont acceptés : il ne s'agit pas d'identifiants uniques.
- La création produit `IN_PROGRESS`, sans gagnant ni date de fin.
- La clôture exige `WHITE_WON` ou `BLACK_WON`. Le service lit le statut d'un vrai
  `Game` ; aucune valeur de gagnant saisie par le joueur n'est prévue.
- Une rencontre inconnue ou déjà terminée est refusée. La fin ne précède pas
  le début ; deux événements au même instant sont acceptés.
- Une erreur de persistance est propagée ; une opération refusée n'écrit rien.
- Les règles de nulle restent hors périmètre, comme dans le moteur actuel.

Le futur adaptateur HTTP devra associer chaque UUID au jeu conservé côté serveur
et contrôler son accès. Recevoir un plateau arbitraire du navigateur puis calculer
son gagnant ne prouverait pas que la rencontre correspondante a été jouée.

## Architecture et doublures

`MatchService → MatchRepository ← adaptateur de persistance`.

`Match` est un instantané immuable. Le moteur reste inchangé. `Clock` et
`Supplier<UUID>` permettent des assertions exactes sans heure système ni hasard.

| Double | Ce que le test veut observer |
|---|---|
| Fake en mémoire | Créer, retrouver puis terminer une rencontre et relire son état |
| Stub | Une rencontre préparée, une absence ou une panne de persistance |
| Mock Mockito ciblé | Aucune écriture lors d'un refus, transmission du résultat valide |

Le fake ne prouve ni SQL, ni transactions, ni droits d'accès. Ces points feront
l'objet des tests d'intégration avec la vraie base ; aucune H2 ne sera ajoutée.
Le port actuel ne promet pas de clôture concurrente atomique : ce contrat devra
être précisé avant l'adaptateur de production.

## Sous-étapes et commits

1. Contrats, port, squelettes compilables et cette spécification.
2. Tests unitaires RED exécutés et documentés avant la logique.
3. Implémentation GREEN sans modifier les attentes des tests.
4. Vérification de la qualité et de la mutation, documentation des résultats.

La persistance réelle, la migration, les tests Testcontainers et le raccordement
API/interface viennent ensuite. Cette étape ne modifie aucun fichier partagé,
n'ajoute aucune dépendance et ne publie ni branche ni PR.

## Journal d'exécution

L'état initial contient uniquement les contrats et des squelettes explicites.
Les valeurs provisoires de `MatchService` et `Match.finish` seront remplacées
après l'exécution de la suite RED.

### Contrats

Branche `game/dame/rencontres`, créée depuis `origin/dev` à `e521099`.
Formatage limité au nouveau package puis `mvn compile` : réussis, sans nouvelle
dépendance. Les méthodes de commande sont encore des squelettes ; ce commit
ne prétend pas livrer la fonctionnalité.
