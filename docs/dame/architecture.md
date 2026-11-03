# Initialisation du jeu de dames — issue #18

## Analyse du dépôt

Analyse du 2 novembre 2026, depuis `origin/dev` à `78cff91`. Arbre local initial propre sur `main`, références récupérées avant création de `game/dame/implementation`. `main` et `origin/dev` avaient le même contenu. La branche de jeu n’existait ni localement ni sur origin.

Sources examinées : README, CONTRIBUTING, docs/architecture, charte graphique, types, SDK, registre et template clicker, page GamePage, sources Java et pom, migrations Supabase, issue [#18](https://github.com/Antoine-Ferron/tiki-gaming/issues/18) rattachée à [#2](https://github.com/Antoine-Ferron/tiki-gaming/issues/2).

Le contrat actuel exige `category`, absent de la liste de champs du ticket : `duel` est explicitement déclaré. `mode: solo` désigne l’accès sans compte et non le nombre de joueurs. Aucun changement du contrat n’est nécessaire pour un duel local. React est en 19, Spring Boot en 3.5.7 et Java en 21. Le backend existant sert l’authentification uniquement ; les scores et sauvegardes passent par Supabase via le SDK.

## État livré

Le template clicker a été copié puis réduit à une page d’attente : aucun minuteur, score, classement, sauvegarde ou règle du clicker conservé. Le composant reçoit `GameProps`, utilise `ctx.isGuest` et `ctx.player` sans importer Supabase. Racine `.dame`, CSS préfixé et composants visuels existants ; aucune vignette fictive. La migration ajoute uniquement le catalogue et n’est pas appliquée.

Le package `fr.tikigaming.games.dame` est documenté par `package-info.java`. `Board` conserve les dimensions 10 × 10 et la parité des cases jouables. Il peut aussi porter une table immuable de pièces fournie explicitement pour les fixtures : le constructeur copie les données et les observations lisent cette table. Le placement initial n'est pas implémenté.

À la demande de préparer tous les tests avant la logique, `Position`, `Piece`, `Player`, `Move`, `GameStatus`, `Game` et `GameRules` sont maintenant préparés. Les records portent les données et les listes sont copiées pour éviter le partage mutable. `Game` conserve les données de la fixture et le camp courant. Les commandes `play` et `reset` lèvent explicitement `UnsupportedOperationException`, les coups légaux sont une liste vide et le statut est provisoirement `IN_PROGRESS`. Aucun déplacement, capture, promotion, victoire ou reset n'est calculé. Voir l'[index de la suite RED](tests-metier.md).

Aucun fichier partagé du backend, dépendance, configuration Spring ou sécurité modifié. Ce package constitue un module logique dans le Maven existant, sans nouveau module Maven.

## Types préparés et responsabilités cibles

| Type | Responsabilité à implémenter | Première US |
|---|---|---|
| Position | Coordonnées immuables, bornes du plateau | US-01 |
| Board | Cases et occupation, sans I/O | US-01 |
| Player | Camp blanc/noir, distinct du compte SDK | US-02 |
| Piece | Camp et nature pion/dame | US-02 |
| Game | État de partie et orchestration du tour | US-03 |
| Move | Origine et parcours complet d’un coup | US-04 puis US-08 |
| GameRules | Calcul des coups légaux, captures et priorité | US-04 puis US-06 |
| GameStatus | Partie en cours, victoire, puis éventuelle nulle | US-11 |

Dépendances souhaitées : futur adaptateur React/SDK → futur adaptateur HTTP → domaine Java. Le domaine n’importe que le JDK ; pas de Spring, annotations JPA, réseau ou base. Les adaptateurs resteront hors du domaine. Les signatures et structures exactes ne sont pas figées avant les tests. Aucun endpoint n’existe à cette étape : React ne peut pas encore appeler le moteur.

## Décisions à valider avec la plateforme

1. **Intégration du moteur Java** : depuis la mise à jour de `dev` à `79f5376`, CONTRIBUTING prévoit explicitement les packages serveur `fr.tikigaming.games.<slug>`. Le choix de `games.dame` respecte donc désormais cette convention. Le contrat d'intégration reste à valider : API, déploiement et disponibilité du service nécessaires pour jouer. « Local » signifie deux personnes sur un ordinateur, pas fonctionnement hors ligne garanti.
2. **Contrat SDK pour les parties** : le GameContext actuel ne sait ni démarrer une partie ni soumettre un coup. Définir avec la plateforme les méthodes, DTO et erreurs ; garder tout accès de jeu via `ctx`. Aucun fetch direct ajouté au composant.
3. **Invités et sécurité** : définir identité de partie, durée de vie, isolation entre navigateurs, limites mémoire, validation des entrées et protection CSRF via le client HTTP existant. La sécurité actuelle permet les requêtes mais protège les POST par CSRF : ne pas désactiver cette protection pour le jeu.
4. **Sauvegardes et scores** : le SDK rattache une sauvegarde et un meilleur score à un seul compte. Les deux camps locaux ne sont pas deux comptes. Définir sérialisation/version, reprise, éventuel classement et attribution de score avant tout appel `submitScore` ; ne pas inventer un score pour un duel.
5. **Revue et livraison** : toute extension backend et la migration nécessitent la revue plateforme selon CONTRIBUTING. Migration non exécutée, schéma inchangé (pas de régénération de types nécessaire pour une simple ligne). Vérifier l’ordre du timestamp avant fusion.
6. **Règles détaillées** : confirmer les scénarios internationaux du backlog et le périmètre des nulles avant US-11 ; pas d’IA ni de multijoueur réseau dans cette version.

Aucune de ces décisions ne bloque les premiers tests unitaires du domaine. Les intégrations HTTP et E2E dépendent de leur validation.

## Mise à jour depuis dev

Le 2 novembre 2026, la branche a été avancée de `78cff91` à `79f5376` par fast-forward, sans conflit, commit local ni push. Les fichiers locaux ont été sauvegardés avant l'opération et conservés. Les mises à jour collectives comprennent CI, Prettier, Vitest, Spotless, Checkstyle, documentation OpenAPI et validation des formulaires/requêtes.

Le code Dames suit maintenant le formatter collectif. Le domaine reste indépendant de Spring ; les annotations Swagger concerneront uniquement les futurs contrôleurs sous `/api/games/dame/...`. Aucun contrôleur n'a été ajouté.

Les commandes de qualité sont décrites dans la [stratégie de tests](strategie-tests.md). Les trois premiers comportements sont GREEN, et la suite complète des douze US est maintenant en RED global ; résultats dans le [journal TDD](journal-tdd.md). La future PR devra rester en draft tant que le travail est en cours. Les exemples de commits incluent désormais `(#18)`. Vérifier la spécification sur l'issue avant tout nouveau comportement, conformément à CONTRIBUTING.

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

Maven est installé et les trois premiers comportements sont GREEN. L'état courant est désormais une suite RED globale, décrite dans l'[index](tests-metier.md) et le [journal TDD](journal-tdd.md). La procédure ci-dessous conserve l'historique du cycle initial suivi pour introduire progressivement le plateau.

1. Rendre Maven disponible avec Java 21, puis exécuter `mvn -f backend/pom.xml test` pour établir l’état de référence de la suite existante.
2. Lire US-01 ; confirmer les coordonnées 0–9 et la parité des cases jouables. Créer `BoardTest` dans le package de test du domaine ; commencer par le seul comportement « un plateau comporte dix lignes et dix colonnes ».
3. Introduire uniquement les signatures nécessaires à la compilation, observer un échec d’assertion ciblé avec `mvn -f backend/pom.xml -Dtest=BoardTest test` et conserver la trace RED.
4. Implémenter ce seul comportement dans Board, observer GREEN, puis lancer la suite backend. Refactorer uniquement si utile et vérifier à nouveau.
5. Répéter pour les cases vides, la parité et les bornes ; ne placer aucun pion avant US-02. Ne faire de commits qu’après autorisation.
