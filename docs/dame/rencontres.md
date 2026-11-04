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
4. Vérification de la qualité et de la mutation, renforcement des assertions si
   nécessaire et documentation des résultats.

La persistance réelle, la migration, les tests Testcontainers et le raccordement
API/interface viennent ensuite. Cette étape ne modifie aucun fichier partagé,
n'ajoute aucune dépendance et ne publie ni branche ni PR.

## Journal d'exécution

Le premier commit contient uniquement les contrats et des squelettes explicites.
Les valeurs provisoires de `MatchService` et `Match.finish` ont ensuite été
remplacées après l'exécution de la suite RED.

### Contrats

Branche `game/dame/rencontres`, créée depuis `origin/dev` à `e521099`.
Formatage limité au nouveau package puis `mvn compile` : réussis, sans nouvelle
dépendance. Les méthodes de commande sont encore des squelettes ; ce commit
ne prétend pas livrer la fonctionnalité.

### RED exécuté

```bash
mvn -B -ntp -f backend/pom.xml '-Dtest=fr.tikigaming.games.dame.matches.*Test' test
```

Résultat : **59 cas, 57 échecs d'assertion attendus, 0 erreur, 0 ignoré**.
Les deux comportements déjà verts concernent les données initiales et les
homonymes. Aucun test désactivé et aucun `fail()` artificiel.

- `MatchTest` : 35 cas de validation, limites, restauration et clôture immuable.
- `MatchServiceTest` : 11 cas avec fake et vrai moteur, dont une victoire obtenue
  par la dernière capture.
- `MatchServiceDoublesTest` : 13 cas distinguant stubs de lecture/panne et
  vérification d'interactions via Mockito.

Le formatage et Checkstyle passent. La première exécution restreinte n'a pas pu
initialiser l'agent Mockito ; la commande a été relancée avec les droits JVM
nécessaires. Le décompte ci-dessus vient de cette exécution complète, sans erreur
d'infrastructure.

### GREEN exécuté

Les mêmes **59 cas passent**, sans modification des attentes. Le modèle valide
les noms et les dates, calcule le camp gagnant et produit un nouvel instantané
lors de la clôture. Le service lit le résultat du moteur, sauvegarde uniquement
une opération valide et laisse remonter les pannes du dépôt.

`mvn clean verify` : **984 tests réussis, 0 échec, 0 erreur, 0 ignoré**, dont
224 tests du moteur Dames et 59 des rencontres. Checkstyle, Spotless et les seuils
JaCoCo sont validés. Le package `games.dame.matches` couvre **44/44 lignes et
21/21 branches**. Ces mesures ne remplacent pas le futur test de la base réelle.

### Renforcement après mutation

Le premier PIT relève un survivant sur les rencontres : supprimer le refus
explicite de `IN_PROGRESS` dans `Match.finish`. Avec une date de fin renseignée,
le constructeur refuse aussi cette incohérence : les tests existants passent
donc malgré la mutation. Avec **`IN_PROGRESS` et une date absente**, le mutant
accepterait à tort la clôture et renverrait une nouvelle rencontre en cours.

Le cas `anUnfinishedResultIsRejectedEvenWhenTheEndDateIsMissing` est ajouté pour
vérifier cette combinaison. Le second PIT confirme qu'il tue précisément ce
mutant. Aucun changement de code de production, d'attente antérieure, de cible,
de mutateur ni de seuil.

Résultats finaux :

- **60 cas des rencontres**, dont 36 pour le modèle, 11 avec fake et vrai moteur,
  13 avec stubs/mocks.
- `mvn clean verify` : **985 tests réussis**, 0 échec, erreur ou ignoré ; format,
  Checkstyle et seuils JaCoCo validés. Les 224 tests du moteur restent verts.
- Rencontres : **44/44 lignes et 21/21 branches couvertes**.
- PIT des rencontres : **22/22 mutants tués, soit 100 %**.
- PIT du profil collectif : **235/242 tués (97,11 %)** ; les sept survivants
  antérieurs du moteur restent [analysés séparément](mutation.md). Aucun mutant
  non couvert, timeout ou erreur.

```bash
# Cas de rencontre seuls
mvn -B -ntp -f backend/pom.xml '-Dtest=fr.tikigaming.games.dame.matches.*Test' test
# Qualité et suite backend
mvn -B -ntp -f backend/pom.xml clean verify
# Mutation, profil collectif inchangé
mvn -B -ntp -f backend/pom.xml -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage
```

Les rapports locaux sont `backend/target/site/jacoco/index.html` et
`backend/target/pit-reports/index.html`, générés et non versionnés. Les mesures
Surefire de la dernière suite complète donnent au plus 2 ms par cas du modèle,
1 ms avec le fake, et 37 ms pour le plus lent avec Mockito. L'initialisation/JIT
de la JVM et des doublures intervient dans ces durées : on ne revendique pas
que chaque cas Mockito respecte déjà strictement le critère de 5 ms du barème.

## Suite à réaliser

La gestion métier est testée avec des doublures ; **aucune rencontre n'est
encore écrite dans une vraie base ni accessible depuis le navigateur**.

1. Préciser l'accès aux rencontres locales et la garantie contre deux clôtures
   concurrentes avant le schéma de production.
2. Ajouter la migration `dame_matches`, RLS et droits explicites, sans appliquer
   de migration à une base partagée.
3. Écrire les tests d'intégration sur PostgreSQL réel avec Testcontainers ; le
   fake ne les remplace pas. Si l'adaptateur utilise PostgREST, tester aussi ce
   trajet HTTP avec le service réel.
4. Implémenter l'adaptateur puis raccorder API, SDK et formulaire des deux noms.

Le daemon Docker local était indisponible lors de la préparation. Aucun résultat
Testcontainers n'est revendiqué dans cette étape unitaire.
