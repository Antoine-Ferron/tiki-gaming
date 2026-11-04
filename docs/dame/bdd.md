# Exemples métier en Gherkin — issue #18

## Statut

Les deux fichiers `.feature` sont maintenant exécutés par `DameBddTest` avec
Cucumber Java/JUnit Platform : **12 cas réussis**, aucun cas ignoré ou étape
indéfinie. Les plans de scénario sont développés à partir des vraies lignes des
tableaux, sans recopier leurs valeurs dans un test Java parallèle.

`RencontreSteps` appelle `MatchService` avec le fake partagé
`InMemoryMatchRepository`, une horloge et un UUID fixes. `PrisesSteps` appelle
directement `Game` et `GameRules`. Cucumber crée des instances d'étapes neuves
par scénario, donc un dépôt neuf pour chaque exemple. Les victoires des deux camps
sont obtenues par de vraies captures de la dernière pièce dans le moteur.
Aucun navigateur, Spring, réseau ou base réelle n'est nécessaire pour ces cas.
Les tests Testcontainers restent la preuve séparée du fonctionnement du stockage.

## Scénarios exécutés

| Fichier | Exemples métier | Comportements Java déjà testés |
|---|---|---|
| [rencontres.feature](../../backend/src/test/resources/features/dame/rencontres.feature) | Création avec deux noms, limites 0/1/50/51, victoires des deux camps, résultat prématuré et remplacement interdit | `MatchTest`, `MatchServiceTest`, `MatchServiceDoublesTest` |
| [prises-et-victoire.feature](../../backend/src/test/resources/features/dame/prises-et-victoire.feature) | Capture obligatoire, maximum de captures et dernière pièce adverse | `MandatoryCaptureTest`, `MultipleCaptureTest`, `GameEndTest` |

Soit **8 scénarios déclarés**, dont 2 plans de scénario, pour **12 cas** après
développement des exemples. Les noms composés de lettres A rendent les frontières
de longueur explicites sans ambiguïté sur les caractères Unicode.

Le « joueur au trait » est celui qui doit jouer. Un « résultat refusé » signifie
que l'état et le gagnant de la rencontre sont conservés. Les étapes vérifient le
type de refus métier et l'état inchangé : une panne quelconque ne suffit pas à
faire passer l'assertion. Le gagnant provient du moteur.

## Relecture métier

Le cours J2 matin présente le BDD comme une discussion métier/dev/QA guidée par des
exemples. Ces textes reprennent notre périmètre convenu ; leur ajout seul ne prouve
pas qu'un atelier avec l'équipe a eu lieu. À relire notamment : la limite de 50
caractères et l'impossibilité de corriger un résultat déjà enregistré.

Les bindings Java sont maintenant réalisés. Aucun moteur de règles n'est
recopié en TypeScript. Le runner frontend avait servi uniquement à vérifier la
lecture des premiers fichiers français, avant leur raccordement au domaine.

## Préparation du runner Java — RED

Cucumber Java et son moteur JUnit Platform, tous deux en version 8.0.4 et de portée
`test`, sont ajoutés avec la suite JUnit Platform gérée par Spring Boot.
`DameBddTest` sélectionne les deux fichiers `features/dame` et produit les rapports
HTML, JSON et JUnit XML dans `backend/target/cucumber`. La découverte directe de
Cucumber est désactivée dans Surefire pour éviter une exécution en double hors
de la suite. Aucun test existant ni seuil n'est désactivé.

Avant les bindings, `mvn -f backend/pom.xml -Dtest=DameBddTest test` découvre bien
**12 cas et échoue sur 12 `UndefinedStepException`**, aucun cas ignoré. C'est un
RED de raccordement : le métier existe déjà, les étapes manquent encore.
Le scénario de résultat immuable précise désormais les deux participants pour
que toutes les valeurs utiles viennent du Gherkin.

## GREEN et contrôle du lien avec les exemples

Les étapes Java font passer les **12 cas**, sans modifier le code de production.
Le fake existant devient public uniquement dans les sources de test pour être
réutilisé depuis le package BDD. Les positions littérales sont des fixtures,
pas des doublures du moteur ; les coordonnées techniques restent hors Gherkin.

Un contrôle négatif temporaire a changé le gagnant noir attendu en `Inconnu` et
le nom accepté de 50 lettres en 51 lettres dans le fichier `.feature`. Les mêmes
12 cas se sont exécutés avec **exactement 2 échecs**, correspondant à ces deux
attentes erronées. Le fichier original a ensuite été restauré. Cela vérifie que
les noms et les nombres du Gherkin pilotent effectivement les assertions.

`mvn -B -ntp -f backend/pom.xml -Pintegration clean verify` réussit ensuite avec
**1 097 tests backend, dont les 12 BDD, et 52 tests d'intégration**, zéro échec,
erreur ou ignoré. Checkstyle, Spotless et les seuils JaCoCo restent verts.

Depuis la racine, pour exécuter uniquement les scénarios, sans Docker :

```bash
mvn -B -ntp -f backend/pom.xml -Dtest=DameBddTest test
open backend/target/cucumber/dame.html
```

Le rapport HTML affiche les scénarios et leurs étapes. Le JSON et le JUnit XML
sont également générés dans `backend/target/cucumber` ; aucun rapport généré
n'est versionné. La suite est incluse dans `mvn test`, `mvn verify` et dans le
profil d'intégration déjà exécuté par le check backend CI.

## Qualité et CI

Le check backend publie également `backend/target/cucumber/` dans l'artefact
`rapport-bdd-dame`, même en cas d'échec. Aucun job existant n'est renommé ou
rendu optionnel. La configuration YAML a été validée localement ; ces nouveaux
commits restent locaux, la CI GitHub n'a pas encore été exécutée pour eux.

PIT reste vert avec **262/270 mutants tués (97,04 %)**, sans mutation non couverte,
timeout ou erreur, et sans changer cibles, seuil, mutateurs ou exclusions. Le
raccordement Gherkin ne modifie aucune classe métier de production ni migration.

Pour la soutenance : lancer `DameBddTest`, ouvrir le rapport HTML et expliquer une
liaison telle que `Quand le joueur noir remporte la partie` → vraie capture noire
dans `Game` → `MatchService.finish` → lecture du résultat dans le fake. Les noms
des participants, camps, longueurs et attentes viennent des étapes et tableaux.
