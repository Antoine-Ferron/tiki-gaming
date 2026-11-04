# BANG! — Distance de tir (#58)

`PlayerDistance.between(state, fromSeat, toSeat)` renvoie la distance de base entre deux joueurs
vivants dans l'état fourni. `state.players()` conserve l'ordre circulaire de la table : le calcul
prend le plus court des deux trajets, en comptant uniquement les joueurs dont `health > 0`.
Les sièges et les comptes restent inchangés, et le calcul ne modifie aucune partie de l'état.
Un siège inconnu ou éliminé à l'une des deux extrémités provoque une `IllegalArgumentException`.

Avec les sièges 1, 2, 3 et 4 vivants, 1–4 vaut 1 et 1–3 vaut 2. Si le siège 2 est éliminé,
1–3 vaut 1. S'il ne reste que 1 et 3, leur distance vaut toujours 1 dans les deux sens.
Les PV maximaux et les pouvoirs des personnages n'interviennent pas dans cette distance de base.
Le contrat `BangCharacter.distanceAsTarget(...)` est conservé pour les pouvoirs.

## Raccordement aux règles

`ShotRules` reçoit déjà un `IntBinaryOperator` et vérifie la portée de base de 1.
Pour une action, raccorder le calculateur au même état courant que celui transmis aux règles :

```java
ShotRules rules = new ShotRules((from, to) -> PlayerDistance.between(state, from, to));
ShotOutcome outcome = rules.fire(state, shooterSeat, cardId, targetSeat, shotsThisTurn);
```

Ce raccordement capture un état : le recréer avec le nouvel état pour l'action suivante,
notamment après une élimination. Le calculateur reçoit explicitement l'état à chaque appel
et ne conserve aucun cache. Les règles existantes refusent une cible hors de portée sans
consommer la carte, ainsi qu'un tir sur soi, sur une cible éliminée ou sur un siège inconnu.

`ShotDistanceRulesTest` associe les vraies règles et le vrai calculateur. Son scénario
d'élimination refuse d'abord le tir 1→3, fait tomber le siège 2 à zéro PV avec `respond`,
puis accepte le même BANG! dans le nouvel état. `ShotOutcome.discarded` garde son contrat.
La synchronisation et l'intégration multijoueur des tirs relèvent de la #59.

## Preuves TDD

Les tests ont précédé chaque comportement de production, depuis la frontière `ShotRules`.
Son collaborateur `IntBinaryOperator` existait déjà ; les valeurs du domaine restent réelles.
L'échec initial de compilation dû au calculateur absent n'est pas compté comme rouge métier :
une coquille retournant zéro a ensuite permis d'observer le premier échec d'assertion.

| Comportement ajouté | Rouge réellement observé | Vert et commit local |
| --- | --- | --- |
| Refuser le joueur opposé et conserver le BANG! | 1 échec d'assertion : le tir n'était pas refusé. | 64 tests ciblés, `15589e1`. |
| Atteindre le dernier siège par le trajet circulaire | 1 erreur métier : « La cible est hors de portée » pour 1→4. | 65 tests ciblés, `5d5a502`. |
| Rapprocher la cible après élimination | 1 erreur métier : 1→3 restait hors de portée après élimination du siège 2. | 66 tests ciblés, `9f4ac9b`. |
| Exiger deux sièges vivants lors d'un calcul direct | 4 échecs d'assertion : siège inconnu ou éliminé accepté, dans les deux sens. | 91 tests ciblés, `b7d5878`. |

Les distances exactes, les deux survivants et les refus existants étaient déjà verts :
leurs tests ont été ajoutés sans fabriquer de rouge, puis stabilisés avec 87 tests ciblés
dans `bbb556e`. Les tests des personnages, des cartes, des tirs et de la distribution initiale
ont été conservés.

## Vérification locale

Le 4 novembre 2026, depuis `backend/` :

- Tests ciblés : **91 cas réussis**, zéro échec, erreur ou test ignoré.
- `mvn spotless:apply` : succès.
- `mvn clean verify` : **1 259 cas réussis**, zéro échec, erreur ou test ignoré ;
  Checkstyle, Spotless et les seuils JaCoCo existants passent sans modification de configuration.

## Intégration finale de `dev`

La récupération finale a apporté `origin/dev` à `c468b79`. L'intégration sans conflit textuel
a révélé deux échecs de documentation API : 37 routes présentes contre 32 attendues, et le
schéma `Card` partagé entre BANG! et un autre jeu (11 champs au lieu des 2 attendus pour BANG!).
Le total exact est devenu 37, soit les 32 routes de chaque branche moins les 27 communes.
Le modèle des cartes BANG! porte désormais `@Schema(name = "BangCard")` ; le JSON de jeu
reste `{ id, type }`. Aucun endpoint n'est ajouté pour la distance.

Le test BANG! a d'abord échoué sur la référence attendue `BangCard`, encore nommée `Card`,
puis les **39 tests de documentation** ont réussi après l'annotation. Le frontend intégré
passe formatage, lint, couverture (**1 257 tests**) et build. Le formateur a uniquement
normalisé ses fins de ligne Windows, sans différence de contenu par rapport à l'index Git.

Après ces corrections, `mvn clean verify` réussit avec **1 337 tests**, zéro échec, erreur
ou test ignoré. Checkstyle, Spotless et tous les seuils JaCoCo existants passent.
