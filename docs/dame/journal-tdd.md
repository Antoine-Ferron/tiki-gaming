# Journal TDD — US-01

Les entrées antérieures au 4 novembre proviennent du travail original de `game/dame/implementation` et décrivent son contexte historique, y compris des étapes frontend absentes de cette première PR. Le périmètre courant est le moteur Java et ses seuls tests unitaires ; voir l'[architecture](architecture.md).

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

## 3 novembre 2026 — troisième test : 50 cases jouables, RED

Reprise sur `game/dame/implementation`, après les deux commits locaux `e0ff406` et `ad0f31c`. Avant tout changement, `mvn -f backend/pom.xml verify` confirme encore **20 tests réussis**, Checkstyle et Spotless verts. Les réglages `.vscode/` restent intacts.

Spécification retenue : US-01 du backlog et demande initiale de l'utilisateur, damier de 100 cases dont 50 jouables. La convention interne proposée reste une somme ligne + colonne impaire pour les cases jouables. Ce cycle teste uniquement leur nombre ; la répartition précise et les coins auront leurs scénarios ensuite.

Un seul test ajouté : `BoardTest.hasFiftyPlayableSquares`.

- **Arrange** : créer un plateau neuf.
- **Act** : parcourir ses 100 coordonnées et compter les réponses `true` de `isPlayable(row, column)`.
- **Assert** : attendre exactement 50 cases jouables.

`Board.isPlayable(int row, int column)` retourne provisoirement `false` afin de compiler et constater un échec comportemental, sans implémenter la parité. Les dimensions et `isEmpty` restent inchangées.

```bash
mvn -f backend/pom.xml -Dtest=BoardTest test
```

Résultat ciblé : **3 tests, 1 échec, 0 erreur** ; les deux premiers tests restent verts. Échec attendu :

```text
[nombre de cases jouables]
expected: 50
 but was: 0
```

Après formatage, `spotless:check` et Checkstyle passent. Suite complète `mvn -f backend/pom.xml verify` : **21 tests, 1 échec, 0 erreur**, seul `hasFiftyPlayableSquares` est RED. La phase de tests arrête donc `verify` avant la fin, comme attendu. Aucun fichier frontend, dépendance ou configuration partagée modifié ; aucun nouveau commit ni push.

Prochaine étape pour l'utilisateur : implémenter uniquement `isPlayable` pour passer ce test GREEN, puis exécuter le test ciblé et `verify`. Les tests de répartition, coins et limites viendront après ; aucun pion ni déplacement introduit.

## 3 novembre 2026 — troisième test GREEN

À la demande de l'utilisateur, `isPlayable(row, column)` est complétée par `return (row + column) % 2 == 1;`. Pour les coordonnées valides 0–9, une somme impaire identifie les cases jouables. Exemple : (0, 0) est non jouable et (0, 1) est jouable. Les autres méthodes restent inchangées.

- Test ciblé `mvn -f backend/pom.xml -Dtest=BoardTest test` : **3 tests réussis**, aucun échec ni erreur.
- Suite complète `mvn -f backend/pom.xml verify` : **21 tests réussis**, Checkstyle sans violation, Spotless vert, `BUILD SUCCESS`.
- `git diff --check` : réussi. Aucun nouveau test, commit ou push dans cette étape GREEN ; aucun changement frontend ou dépendance.

US-01 reste en cours : le troisième test vérifie le nombre de cases jouables, mais la répartition exacte, les coins et les coordonnées hors plateau attendent leurs scénarios dédiés. La validation des bornes n'est pas implémentée par ce cycle.

## 3 novembre 2026 — suite de spécification US-01 à US-12, RED global

L'utilisateur demande maintenant tous les tests avant l'implémentation de la logique. La méthode change donc de petits cycles vers une phase RED globale, puis un GREEN à réaliser progressivement. Cette demande remplace la limitation précédente à un seul test par étape. Aucun nouveau commit ni push autorisé dans ce travail.

Avant la préparation, `mvn -f backend/pom.xml verify` confirme **21 tests réussis**, Checkstyle et Spotless verts. Les trois comportements Dames précédents sont conservés.

La suite est répartie en 13 classes de tests couvrant US-01 à US-12, avec des fixtures de positions explicites et des cas paramétrés. Une relecture indépendante des positions a vérifié les captures obligatoires, les branches majoritaires, les obstacles des dames et les promotions différées. Le placement initial attendu est une table littérale de 40 pièces commune au placement et au reset. Les sources et le détail des scénarios figurent dans l'[index des tests métier](tests-metier.md).

Pour compiler ces tests sans moteur, les types de données du domaine sont préparés : Position, Piece, Player, Move, GameStatus, Game et GameRules. Board copie une table immuable de pièces fournie par les fixtures et ses observations lisent ces données ; `isEmpty` n'est plus une constante. Aucun placement initial, déplacement, capture, promotion, victoire ou reset n'est calculé. Les commandes manquantes sont des stubs explicites ; les assertions des tests rendent leurs échecs lisibles.

Vérifications effectuées :

- `mvn -f backend/pom.xml -DskipTests test-compile` : **BUILD SUCCESS**, tous les tests compilent.
- `mvn -f backend/pom.xml spotless:apply` : formatage appliqué aux seuls nouveaux fichiers de tests concernés.
- `mvn -f backend/pom.xml spotless:check verify` : Spotless vert, **0 violation Checkstyle**, puis RED attendu aux tests.
- Domaine Dames : **220 cas**, **191 échecs**, **29 réussites**, **0 erreur**, **0 ignoré**.
- Backend complet : **238 cas**, **191 échecs**, **47 réussites**, **0 erreur**, **0 ignoré**. Les **18 tests collectifs** restent verts.
- Rapports Surefire générés dans `backend/target/surefire-reports/`. Aucun test désactivé, aucun `fail()` artificiel ni Mockito dans les tests du domaine.
- Aucun changement de pom.xml, dépendance, frontend, authentification, configuration ou migration. Les réglages locaux `.vscode/` restent intacts.

Les règles de nulle et le traitement d'une fixture artificielle avec un pion déjà posé sur sa rangée de promotion restent à spécifier, sans comportement arbitraire imposé par les tests. Les tests d'intégration API et E2E React restent planifiés après définition de leurs contrats.

Prochaine phase : prendre les classes dans l'ordre US-01 à US-12, implémenter le minimum nécessaire, puis vérifier la progression du nombre d'échecs jusqu'à la suite verte. Les prochains développements ne doivent ni désactiver les scénarios avancés ni affaiblir les assertions pour masquer RED.

## 3 novembre 2026 — commit RED, puis GREEN de US-01

À la demande de l'utilisateur, le commit local `2c03072` est créé : `test(dame): spécifie les règles du jeu en phase RED (#18)`. Il contient les 27 fichiers du domaine Dames, de tests et de documentation revus. L'état RED a été revérifié avant commit : 238 cas backend, 191 échecs attendus, aucune erreur, tests collectifs verts, format et linter verts. Les réglages `.vscode/` sont exclus ; aucun push.

Le GREEN commence par US-01 uniquement :

- Le constructeur de Position refuse toute coordonnée inférieure à 0 ou supérieure à 9.
- Board conserve la copie immuable de ses pièces et refuse une pièce sur une case claire.
- `isPlayable(row, column)` construit d'abord une Position validée, puis calcule la parité ; les lectures `isEmpty` et `pieceAt` reposent sur les mêmes coordonnées validées.
- Aucun test modifié ou désactivé. `Board.initial()`, les coups légaux, les commandes de jeu et le reset restent des stubs pour les US suivantes.

Vérifications :

- `mvn -f backend/pom.xml -Dtest=BoardTest,PositionTest test` : **42 tests, 0 échec, 0 erreur**, `BUILD SUCCESS`.
- `mvn -f backend/pom.xml spotless:check verify` : format et Checkstyle verts, puis **238 tests, 166 échecs attendus, 0 erreur, 0 ignoré** ; les 18 tests collectifs restent verts.
- Domaine Dames : **220 cas, 54 réussites et 166 échecs**. Les échecs passent de 191 à 166 : 17 cas de US-01 et 8 cas hors limites de US-05 deviennent verts. Ces huit derniers refusent une Position invalide avant l'appel du moteur, sans ajouter de règle de déplacement.

Le commit RED reste inchangé. Les modifications GREEN de US-01 sont dans le répertoire de travail, pas encore committées. La suite continue à être volontairement rouge pour les US suivantes. Prochaine étape proposée : US-02, placer les 20 pions de chaque camp et garder les assertions existantes.

## 3 novembre 2026 — moteur complet GREEN

L'utilisateur demande maintenant de rendre toute la suite verte avant le prochain commit. Cette demande étend le périmètre GREEN au moteur des US-01 à US-12, en gardant les assertions existantes. Le commit RED `2c03072` reste inchangé ; aucun commit ni push pendant cette implémentation.

Implémentation :

- `Board.initial()` place 20 pions noirs sur les lignes 0–3 et 20 blancs sur 6–9, sur les cases jouables uniquement.
- `GameRules.legalMoves` recherche les rafles complètes de chaque pièce, puis conserve le plus grand nombre global de prises. Les pions capturent dans les quatre directions ; les dames explorent chaque arrivée libre après le premier adversaire sur une diagonale.
- La recherche déplace uniquement la pièce active dans une copie de la position ; les victimes restent bloquantes et un ensemble interdit leur seconde capture. Les cases quittées sont libres, donc les cycles et retours à l'origine restent possibles.
- En l'absence de capture, les déplacements ordinaires sont proposés : une case en avant pour un pion, diagonales libres pour une dame.
- `GameRules.apply` refuse d'abord un parcours absent des coups légaux, puis construit un nouveau plateau, retire les victimes à la fin et promeut uniquement sur l'arrivée finale. L'ancien plateau reste intact.
- `Game.play` prépare plateau, camp suivant et statut avant de modifier l'état ; il refuse toute commande après terminaison. `reset` reconstitue la position initiale sans modifier d'ancienne référence.
- Le statut détecte l'absence de pièce ou de coup légal du camp devant jouer, et attribue la victoire à l'autre camp. Les règles de nulle restent à définir séparément.

Première vérification sans toucher aux assertions existantes : **220 tests métier verts**, puis `mvn -f backend/pom.xml verify` : **238 tests verts**, compilation, packaging, Checkstyle et Spotless réussis.

La relecture a ensuite relevé une incohérence non couverte : `Game(Board, Player)` annonçait `IN_PROGRESS` pour une position reconstruite déjà terminale. Quatre cas paramétrés ont été ajoutés à `GameEndTest` (deux camps sans pièce, deux camps bloqués). RED ciblé observé : **17 cas, 4 échecs, 0 erreur**, avec le statut de victoire attendu au lieu de `IN_PROGRESS`. Le constructeur calcule maintenant son statut via les règles ; aucune assertion existante n'a été affaiblie ni supprimée.

Vérification finale :

- `mvn -f backend/pom.xml verify` : **242 tests, 0 échec, 0 erreur, 0 ignoré**, `BUILD SUCCESS`.
- **224 cas Dames** répartis dans les mêmes 13 classes ; les 18 cas collectifs restent verts. US-11 comporte désormais 17 cas au lieu de 13.
- Checkstyle : **0 violation** ; Spotless réussi ; jar Spring Boot reconstruit.
- Aucun changement frontend, pom.xml, dépendance, authentification, configuration collective ou migration. `.vscode/` reste local.

La documentation d'architecture, la stratégie et l'index sont actualisés. Les modifications GREEN attendent un prochain commit autorisé. Le navigateur affiche encore la page d'attente : l'adaptateur API/SDK et l'interface de plateau React restent à concevoir avec la plateforme. Aucun pourcentage de couverture ou validation E2E n'est déduit de cette suite verte.

## 3 novembre 2026 — commit GREEN autorisé

L'utilisateur demande d'enregistrer le GREEN vérifié dans un commit local : `feat(dame): implémente le moteur de dames internationales (#18)`. Le commit regroupe le moteur, les quatre cas supplémentaires de GameEndTest et la documentation actualisée. Le commit RED `2c03072` reste dans l'historique sans réécriture.

Validation de référence : `mvn -f backend/pom.xml verify`, 242 tests réussis (224 Dames et 18 collectifs), compilation, packaging, Checkstyle et Spotless verts. Le code et les tests sont inchangés depuis cette vérification ; seuls les statuts documentaires sont actualisés pour l'enregistrement du commit. Les réglages `.vscode/` restent hors du commit. Aucun push ni PR.

## 4 novembre 2026 — première PR limitée aux tests unitaires

L'utilisateur demande une PR directement prête à relire et réserve les tests d'intégration à une autre PR. Un worktree isolé `/private/tmp/tiki-dame-unitaires` porte `game/dame/tests-unitaires`, depuis `dev` à `0317320`. La branche originale reste intacte au commit `62b2458`, avec l'API, le SDK, l'interface et les tests d'intégration pour la suite.

Les quatre premières étapes sont reprises en conservant l'auteur et l'ordre, mais en ne gardant que le domaine, ses tests et la documentation : `baac4c3 → d7d1bb4`, `d2b42c1 → faed34f`, `309ab8b → 2b95d64`, `d097cfc → 8f73f29`. Le RED est rejoué : 220 cas, 191 échecs, zéro erreur ou test ignoré. Le GREEN ciblé passe ensuite les 224 cas. Il s'agit d'une reprise vérifiée de l'historique existant, pas d'un nouveau cycle TDD inventé.

`mvn clean verify` réussit sur cette branche avec **847 cas**, dont **224 métier Dames et 623 collectifs**, zéro échec, erreur ou test ignoré. Checkstyle, Spotless et les seuils JaCoCo passent. Le domaine atteint **187/187 lignes et 128/128 branches (100 %)**. Les seules modifications du pom ajoutent le package et les tests Dames aux cibles du profil PIT existant, en conservant l'authentification, les mutateurs et le seuil de 75 %. Aucune dépendance, migration, API, modification SDK ou frontend dans cette PR.

Le profil PIT complet réussit : **213 mutations tuées sur 220 (96,82 %)**, dont **149/156 pour Dames (95,51 %)** et 64/64 pour l'authentification. Aucun timeout, mutant non couvert ou erreur d'exécution. Les sept survivants du domaine sont documentés dans [mutation.md](mutation.md) : six équivalences argumentées et une limite de sensibilité au message du refus après fin de partie. Aucun seuil, mutateur ou exclusion affaibli. Cette PR ne revendique aucun test d'intégration propre à Dames et référence #18 sans fermer l'issue complète.

## 4 novembre 2026 — rencontres locales, après fusion de #93

À la demande de l'utilisateur, préparer les rencontres avant la persistance et
faire un commit à chaque sous-étape. Branche `game/dame/rencontres` créée depuis
`dev` à `e521099`. L'ancien travail API/interface reste conservé sur
`game/dame/implementation` et les réglages VS Code restent locaux.

- `d7da509` : modèle, port, service encore squelettique et contrat documenté.
- `cbde5d0` : RED réellement exécuté, **59 cas, 57 échecs attendus, 0 erreur**.
- `389b891` : GREEN des mêmes 59 cas ; **984 tests backend réussis**.
- Renforcement après PIT : un cas supplémentaire refuse `IN_PROGRESS` même sans
  date de fin ; PIT identifie ce nouveau test comme tueur du mutant survivant.
  État final : **60 cas des rencontres**, **985 tests backend réussis**, JaCoCo
  des rencontres **100 % lignes/branches**, PIT **22/22 mutants tués**.

Les tests utilisent le vrai moteur, un fake de dépôt, des stubs de réponse/panne
et des mocks ciblés sur les écritures. Aucun adaptateur de base, endpoint,
changement frontend ou dépendance n'est ajouté dans cette étape. Détails,
commandes, limites et suite dans [rencontres.md](rencontres.md).
