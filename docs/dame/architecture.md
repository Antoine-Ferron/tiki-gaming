# Initialisation du jeu de dames — issue #18

## Analyse du dépôt

Analyse du 2 novembre 2026, depuis `origin/dev` à `78cff91`. Arbre local initial propre sur `main`, références récupérées avant création de `game/dame/implementation`. `main` et `origin/dev` avaient le même contenu. La branche de jeu n’existait ni localement ni sur origin.

Sources examinées : README, CONTRIBUTING, docs/architecture, charte graphique, types, SDK, registre et template clicker, page GamePage, sources Java et pom, migrations Supabase, issue [#18](https://github.com/Antoine-Ferron/tiki-gaming/issues/18) rattachée à [#2](https://github.com/Antoine-Ferron/tiki-gaming/issues/2).

Le contrat actuel exige `category`, absent de la liste de champs du ticket : `duel` est explicitement déclaré. `mode: solo` désigne l’accès sans compte et non le nombre de joueurs. Aucun changement du contrat n’est nécessaire pour un duel local. React est en 19, Spring Boot en 3.5.7 et Java en 21. Le backend existant sert l’authentification uniquement ; les scores et sauvegardes passent par Supabase via le SDK.

## État livré

Le template clicker a été copié puis réduit à une page d’attente : aucun minuteur, score, classement, sauvegarde ou règle du clicker conservé. Le composant reçoit `GameProps`, utilise `ctx.isGuest` et `ctx.player` sans importer Supabase. Racine `.dame`, CSS préfixé et composants visuels existants ; aucune vignette fictive. La migration ajoute uniquement le catalogue et n’est pas appliquée.

Le package `fr.tikigaming.games.dame` est documenté par `package-info.java`. `Board` conserve les dimensions 10 × 10 et la parité des cases jouables. Il porte une table immuable de pièces, copiée par le constructeur, et refuse les pièces sur cases claires. `Position` valide les coordonnées 0–9 ; les lectures du plateau utilisent cette validation. `Board.initial()` place les 20 pions noirs sur les lignes 0–3 et les 20 pions blancs sur les lignes 6–9, avec les lignes centrales vides.

Le moteur métier est maintenant implémenté pour le périmètre testé des douze US : déplacements, refus, prises obligatoires et majoritaires, rafles, dames volantes, promotion finale, victoire et réinitialisation. Les records portent les données et les listes sont copiées pour éviter le partage mutable. `Game` conserve la position courante, le camp au trait et le statut ; il évalue aussi le statut d'une position reconstruite dès le constructeur. Les **224 cas métier passent**, ainsi que les 18 tests collectifs, soit **242 cas verts**. Voir l'[index de la suite métier](tests-metier.md). L'interface React reste une page d'attente : aucun endpoint ni raccordement au moteur n'est ajouté.

Aucun fichier partagé du backend, dépendance, configuration Spring ou sécurité modifié. Ce package constitue un module logique dans le Maven existant, sans nouveau module Maven.

## Types du domaine et responsabilités

| Type | Responsabilité | Première US |
|---|---|---|
| Position | Coordonnées immuables, bornes du plateau | US-01 |
| Board | Cases et occupation, sans I/O | US-01 |
| Player | Camp blanc/noir, distinct du compte SDK | US-02 |
| Piece | Camp et nature pion/dame | US-02 |
| Game | État de partie et orchestration du tour | US-03 |
| Move | Origine et parcours complet d’un coup | US-04 puis US-08 |
| GameRules | Calcul des coups légaux, captures et priorité | US-04 puis US-06 |
| GameStatus | Partie en cours, victoire, puis éventuelle nulle | US-11 |

Dépendances souhaitées : futur adaptateur React/SDK → futur adaptateur HTTP → domaine Java. Le domaine n’importe que le JDK ; pas de Spring, annotations JPA, réseau ou base. Les adaptateurs resteront hors du domaine. Le contrat Java courant est décrit dans l'index des tests ; les échanges HTTP restent à définir. Aucun endpoint n’existe à cette étape : React ne peut pas encore appeler le moteur.

## Comprendre le traitement d'un coup

`Game.play` refuse d'abord une commande sur une partie terminée. `GameRules.apply` vérifie ensuite que le parcours demandé appartient à la liste des coups légaux et construit un nouveau plateau sans modifier l'ancien. Le camp suivant et son statut sont calculés avant toute affectation : un refus conserve donc plateau, tour et statut. Un coup complet accepté change le camp une fois, même s'il donne la victoire. `reset` reconstruit la position initiale, remet les blancs au trait et rétablit `IN_PROGRESS`.

Pour les rafles, `GameRules` utilise une recherche en profondeur (DFS) : il suit une possibilité de capture jusqu'à sa fin, puis revient explorer les autres possibilités. Chaque branche conserve son parcours et les victimes déjà prises. Les victimes restent présentes et bloquantes jusqu'à la fin du coup, mais ne peuvent pas être prises une seconde fois. Le moteur conserve ensuite les parcours complets qui prennent le plus de pièces, parmi toutes les pièces du camp actif. En l'absence de capture, il propose les déplacements ordinaires. La promotion est appliquée uniquement sur la dernière arrivée du parcours.

## Décisions à valider avec la plateforme

1. **Intégration du moteur Java** : depuis la mise à jour de `dev` à `79f5376`, CONTRIBUTING prévoit explicitement les packages serveur `fr.tikigaming.games.<slug>`. Le choix de `games.dame` respecte donc désormais cette convention. Le contrat d'intégration reste à valider : API, déploiement et disponibilité du service nécessaires pour jouer. « Local » signifie deux personnes sur un ordinateur, pas fonctionnement hors ligne garanti.
2. **Contrat SDK pour les parties** : le GameContext actuel ne sait ni démarrer une partie ni soumettre un coup. Définir avec la plateforme les méthodes, DTO et erreurs ; garder tout accès de jeu via `ctx`. Aucun fetch direct ajouté au composant.
3. **Invités et sécurité** : définir identité de partie, durée de vie, isolation entre navigateurs, limites mémoire, validation des entrées et protection CSRF via le client HTTP existant. La sécurité actuelle permet les requêtes mais protège les POST par CSRF : ne pas désactiver cette protection pour le jeu.
4. **Sauvegardes et scores** : le SDK rattache une sauvegarde et un meilleur score à un seul compte. Les deux camps locaux ne sont pas deux comptes. Définir sérialisation/version, reprise, éventuel classement et attribution de score avant tout appel `submitScore` ; ne pas inventer un score pour un duel.
5. **Revue et livraison** : toute extension backend et la migration nécessitent la revue plateforme selon CONTRIBUTING. Migration non exécutée, schéma inchangé (pas de régénération de types nécessaire pour une simple ligne). Vérifier l’ordre du timestamp avant fusion.
6. **Règles détaillées** : faire relire les scénarios internationaux du backlog et spécifier le périmètre des nulles avant de clore US-11 ; pas d’IA ni de multijoueur réseau dans cette version.

Le moteur se vérifie par ses tests unitaires sans ces intégrations. Les intégrations HTTP et E2E dépendent de leur validation ; le périmètre des nulles reste à spécifier avant de déclarer US-11 terminée.

## Mise à jour depuis dev

Le 2 novembre 2026, la branche a été avancée de `78cff91` à `79f5376` par fast-forward, sans conflit, commit local ni push. Les fichiers locaux ont été sauvegardés avant l'opération et conservés. Les mises à jour collectives comprennent CI, Prettier, Vitest, Spotless, Checkstyle, documentation OpenAPI et validation des formulaires/requêtes.

Le code Dames suit maintenant le formatter collectif. Le domaine reste indépendant de Spring ; les annotations Swagger concerneront uniquement les futurs contrôleurs sous `/api/games/dame/...`. Aucun contrôleur n'a été ajouté.

Les commandes de qualité sont décrites dans la [stratégie de tests](strategie-tests.md). Le RED global est conservé dans le commit `2c03072`. La suite métier complète est désormais GREEN, avec les résultats dans le [journal TDD](journal-tdd.md). À la demande de l'utilisateur, cette implémentation et les quatre tests de régression supplémentaires sont regroupés dans un commit GREEN distinct du commit RED. Aucun push effectué. La future PR devra rester en draft tant que le travail est en cours. Les exemples de commits incluent désormais `(#18)`. Vérifier la spécification sur l'issue avant tout nouveau comportement, conformément à CONTRIBUTING. L'issue #18 n'est pas déclarée terminée : intégration, revue et décisions de périmètre restent ouvertes.

## Vérifications de cette initialisation (historique)

- `npm ci` : dépendances existantes du lockfile installées, sans modification de package.json/package-lock.json ; première tentative bloquée par le réseau du sandbox, relance avec accès réseau réussie.
- `npm run lint` : réussi.
- `npm run build` : réussi, TypeScript et Vite ; bundle DameGame distinct chargé à la demande.
- Java 21 disponible ; `javac -d /private/tmp/tiki-dame-compile backend/src/main/java/fr/tikigaming/games/dame/package-info.java` réussi. Ce contrôle ne remplace pas un build backend.
- `mvn -f backend/pom.xml test` : impossible, Maven absent du PATH ; aucun wrapper Maven présent. Build Maven et suite existante à relancer après installation de Maven. Aucune installation d’outil backend effectuée.
- `git diff --check` : réussi ; template clicker, SDK, types, configuration backend et manifests de dépendances inchangés.
- Migration non appliquée ; aucune connexion à une base, aucun commit, push, nouvelle issue ou PR.
- Contrôle visuel en navigateur et largeur 360 px non réalisé ; prévu dans la stratégie future.

## Procédure de démarrage US-01

Maven est installé et les 224 cas métier sont GREEN. Les résultats courants et l'historique RED global sont décrits dans l'[index](tests-metier.md) et le [journal TDD](journal-tdd.md). La procédure ci-dessous conserve l'historique du cycle initial suivi pour introduire progressivement le plateau.

1. Rendre Maven disponible avec Java 21, puis exécuter `mvn -f backend/pom.xml test` pour établir l’état de référence de la suite existante.
2. Lire US-01 ; confirmer les coordonnées 0–9 et la parité des cases jouables. Créer `BoardTest` dans le package de test du domaine ; commencer par le seul comportement « un plateau comporte dix lignes et dix colonnes ».
3. Introduire uniquement les signatures nécessaires à la compilation, observer un échec d’assertion ciblé avec `mvn -f backend/pom.xml -Dtest=BoardTest test` et conserver la trace RED.
4. Implémenter ce seul comportement dans Board, observer GREEN, puis lancer la suite backend. Refactorer uniquement si utile et vérifier à nouveau.
5. Répéter pour les cases vides, la parité et les bornes ; ne placer aucun pion avant US-02. Ne faire de commits qu’après autorisation.
