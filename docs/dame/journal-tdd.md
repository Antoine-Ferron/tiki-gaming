# Journal TDD — US-01

## 2 novembre 2026 — premier test, RED

Branche : `game/dame/implementation`. Périmètre autorisé : rendre Maven disponible puis écrire uniquement le premier test ; étape GREEN à suivre séparément.

### Environnement

Maven 3.9.11 installé depuis la distribution officielle Apache sur Maven Central, somme SHA-512 vérifiée. Installation : `/Users/Cherif/.local/share/apache-maven-3.9.11`, commande `mvn` accessible via `/opt/homebrew/bin/mvn`. Java utilisé : Temurin 21.0.12.1. Aucun changement de pom.xml ou de dépendance du projet.

L'installation Homebrew a été arrêtée au téléchargement car elle prévoyait aussi Java 27 et de nombreuses dépendances ; aucune installation de formule effectuée. Maven a ensuite été installé seul.

### État de référence

Avant création du test, `mvn -f backend/pom.xml test` : **2 tests, 0 échec, 0 erreur, BUILD SUCCESS**. Ces tests existants concernent l'authentification. La première tentative était bloquée par les droits d'écriture du cache `.m2` ; la relance avec les droits nécessaires a permis de télécharger le provider JUnit de Surefire et d'exécuter les tests.

### Premier comportement

`BoardTest.hasTenRowsAndTenColumns` vérifie seulement les dimensions attendues d'un damier international : 10 lignes et 10 colonnes.

- **Arrange** : créer un `Board`.
- **Act** : lire `rowCount()` et `columnCount()`.
- **Assert** : attendre 10 pour chaque dimension. `assertAll` permet d'afficher les deux assertions même si la première échoue ; il s'agit d'un seul test.

`Board` contient uniquement les deux méthodes nécessaires à la compilation, retournant provisoirement 0. Le test s'exécute et échoue sur le comportement manquant ; aucune règle, case ou pièce n'est implémentée. Aucune utilisation de Spring ou Mockito.

### Reproduire RED

Depuis la racine :

```bash
mvn -f backend/pom.xml -Dtest=BoardTest test
```

Résultat observé : **1 test, 1 échec, 0 erreur, 0 ignoré**, avec les deux messages :

```text
[nombre de lignes] expected: 10 but was: 0
[nombre de colonnes] expected: 10 but was: 0
```

`BUILD FAILURE` et le code de sortie 1 sont attendus à cette étape. Rapports détaillés générés dans `backend/target/surefire-reports/` (ignorés par Git).

Suite complète relancée avec `mvn -f backend/pom.xml test` : **3 tests, 1 échec, 0 erreur**. Les 2 tests d'authentification passent toujours ; seul le nouveau test `BoardTest` échoue. `git diff --check` passe également.

### Prochaine étape

GREEN : implémenter uniquement les dimensions de `Board` pour satisfaire ce test, puis relancer le test ciblé et la suite complète. Ne pas ajouter les cases, les positions ni les pions avant leurs tests respectifs. Aucun commit ou push effectué.

## 2 novembre 2026 — intégration des outils de qualité de dev

Références récupérées avec `git fetch origin`, puis `git merge --ff-only origin/dev` : la branche passe de `78cff91` à `79f5376`, sans conflit ni nouveau commit. Sauvegarde préalable des changements locaux dans `/private/tmp/tiki-dame-before-dev-vq7gfjt1` ; tous les fichiers Dames sont conservés.

Nouveaux outils récupérés : Prettier, Vitest, Spotless/Palantir, Checkstyle et workflow CI. Les dépendances du lockfile ont été synchronisées avec `npm ci`, sans ajout propre au jeu. Spotless a reformatté uniquement `BoardTest` ; Prettier a confirmé le format des fichiers frontend Dames et du registre. Aucun comportement du jeu n'a changé.

Vérifications effectuées :

- Frontend : `npm run format:check`, `npm run lint`, `npm test` (**12 tests réussis**) et `npm run build` réussis.
- Backend : `mvn -f backend/pom.xml spotless:check checkstyle:check` réussi, **0 violation Checkstyle**.
- Commande de CI backend `mvn -f backend/pom.xml verify` : **19 tests, 1 échec, 0 erreur, 0 ignoré**. Les **18 tests collectifs passent** ; seul `BoardTest.hasTenRowsAndTenColumns` reste RED (10 attendu, 0 obtenu). Le détail est dans les rapports Surefire. La phase de tests arrêtant `verify`, Spotless a aussi été contrôlé séparément.
- Java 21 inchangé. Node local : 26.10.0 ; la CI utilise Node 24. Les contrôles ont été exécutés localement, aucune CI distante lancée.
- `git diff --check` réussi ; aucune modification locale des fichiers de plateforme issus de `dev`, sauf l'ajout Dames au registre déjà présent avant mise à jour.

Documentation alignée sur CONTRIBUTING : numéro `(#18)` obligatoire dans les futurs commits, packages serveur de jeux reconnus, future PR en draft pendant le travail et CI verte requise avant relecture/fusion. Aucun commit, push ou PR effectué ; GREEN reste la prochaine étape.

## 2 novembre 2026 — dimensions GREEN, puis cases vides RED

L'utilisateur a implémenté `rowCount()` et `columnCount()` en retournant 10. Modification conservée : le premier test ciblé passe, puis `mvn -f backend/pom.xml verify` confirme **19 tests réussis**, Checkstyle et Spotless verts, `BUILD SUCCESS`. Aucun refactoring structurel nécessaire pour ce petit incrément. Une première tentative de suite complète était bloquée par les restrictions du sandbox sur l'attachement JVM de Mockito ; la relance avec les droits nécessaires a réussi sans changement du code.

Le deuxième comportement de US-01 est préparé par `BoardTest.startsWithOneHundredEmptySquares` : pour chacune des 100 coordonnées (lignes 0–9, colonnes 0–9), une case du plateau neuf doit être vide. L'observation publique `isEmpty(int row, int column)` évite d'introduire une représentation interne, Position ou Piece avant leurs tests. Elle retourne provisoirement `false` pour constater RED. Aucun pion ou déplacement n'est implémenté.

```bash
mvn -f backend/pom.xml -Dtest=BoardTest test
```

Résultat : **2 tests, 1 échec, 0 erreur**. Le premier test reste vert ; le nouveau s'arrête sur la première case :

```text
[la case (0, 0) d'un damier neuf est vide]
Expecting value to be true but was false
```

Après formatage, Spotless et Checkstyle passent. Suite complète `mvn -f backend/pom.xml verify` : **20 tests, 1 échec, 0 erreur** ; les 18 tests collectifs et le premier test Dames passent. Seul le nouveau test est volontairement RED. `git diff --check` passe ; les réglages locaux `.vscode/` de l'utilisateur sont conservés sans modification.

Prochaine étape : implémenter seulement l'observation des cases vides pour faire passer ce deuxième test, puis relancer le test ciblé et `verify`. Les cases jouables, les bornes et les pions restent pour leurs prochains cycles. Aucun commit ou push effectué.

## 2 novembre 2026 — cases vides GREEN et premiers commits

L'utilisateur a fait retourner `true` à `isEmpty(row, column)` : implémentation minimale suffisante pour un plateau neuf sans pièce. Les deux tests Dames sont maintenant GREEN. La Javadoc de Board a été actualisée sans modifier ce comportement. US-01 reste en cours : la parité des cases jouables et la validation des coordonnées n'ont pas encore leurs tests ; aucun pion ni déplacement n'existe.

Contrôles avant les premiers commits :

- `mvn -f backend/pom.xml verify` : **20 tests, 0 échec, 0 erreur**, Checkstyle et Spotless réussis, `BUILD SUCCESS`.
- Frontend : `npm run format:check`, `npm run lint`, `npm test` (**12 tests réussis**) et `npm run build` réussis.
- `git diff --cached --check` : aucun problème de whitespace dans les fichiers préparés.

Les étapes RED précédentes sont conservées dans ce journal ; aucun historique de commits RED n'est reconstitué après coup. Les premiers commits locaux autorisés séparent :

1. `chore(dame): initialise le module et le backlog TDD (#18)` : frontend, catalogue, package métier et documentation préparatoire.
2. `feat(dame): définit les dimensions et les cases vides du damier (#18)` : Board, ses deux tests et les traces RED/GREEN avec les statuts documentaires actualisés.

Les commits utilisent le nom du profil GitHub connecté et son adresse privée `noreply`, sans modifier la configuration Git globale. Les réglages `.vscode/` restent locaux. Aucun push ni PR ; migration non appliquée.

Prochaine étape : écrire un nouveau test RED sur les cases jouables, après vérification de la spécification liée à #18, puis poursuivre le cycle TDD. Ce comportement n'est pas développé dans ces commits.
