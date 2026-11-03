# Suite de spécification métier — US-01 à US-12

Le 3 novembre 2026, l'utilisateur demande tous les tests avant l'implémentation. Cette suite est une phase RED globale : elle spécifie le comportement cible du moteur Java pur. Elle ne rend pas le jeu jouable. Les tests d'intégration HTTP et E2E React restent prévus dans la stratégie, sans contrat technique inventé.

## Résultats observés

- **220 cas métier** dans 13 classes JUnit 5, avec tests paramétrés.
- **191 échecs attendus**, **29 cas déjà verts**, **0 erreur**, **0 test ignoré**.
- Les **18 tests collectifs restent verts**, soit **238 cas au total** et 191 échecs.
- Compilation, Spotless et Checkstyle réussis ; `verify` s'arrête sur les échecs de la phase RED.
- Aucun test `@Disabled`, aucun `fail()` artificiel, aucune dépendance ajoutée, aucun mock dans le domaine.

Les 29 cas verts portent sur les comportements déjà en place, les observations de données et les types préparés. Aucun pourcentage de couverture n'est annoncé : les stubs ne sont pas un moteur et les fonctions encore absentes sont précisément spécifiées par les tests RED.

## Index et ordre conseillé pour GREEN

Les nombres comptent les invocations paramétrées, et non seulement les méthodes `@Test`.

| US | Classes dans `backend/src/test/java/fr/tikigaming/games/dame/` | Cas | RED | Principaux comportements |
|---|---|---:|---:|---|
| 01 | `BoardTest`, `PositionTest` | 42 | 17 | Dimensions, vide, parité, coins, bornes, refus des cases claires occupées, snapshots |
| 02 | `InitialPlacementTest` | 13 | 10 | 40 pions, 20/20, positions exactes, centre vide, aucun pion promu |
| 03 | `TurnManagementTest` | 4 | 3 | Blancs d'abord, alternance, pièce adverse, double tour refusé |
| 04 | `SimpleMovementTest` | 8 | 8 | Deux camps, deux diagonales avant, bords, occupation et effectifs |
| 05 | `InvalidMoveTest` | 26 | 26 | Origine vide, mauvaise direction/distance, obstacles, routes et commandes invalides, atomicité |
| 06 | `SingleCaptureTest` | 15 | 15 | Quatre directions pour chaque camp, alliés, arrivée occupée, capture au bord |
| 07 | `MandatoryCaptureTest` | 6 | 6 | Obligation globale, autre pièce, prise arrière, absence de capture |
| 08 | `MultipleCaptureTest` | 17 | 17 | Rafles complètes, maximum global et par branche, égalités, double prise, retour à l'origine |
| 09 | `PromotionTest` | 21 | 21 | Deux camps, arrivée finale, passage puis sortie, aucune dame volante pendant la rafle |
| 10 | `KingMovementTest` | 45 | 45 | Distances 1–9, obstacles, captures volantes, arrivées, majorité, retrait différé, boucles |
| 11 | `GameEndTest` | 13 | 13 | Élimination, blocage, coup restant, statut après coup complet, état terminal |
| 12 | `GameResetTest` | 10 | 10 | Après mouvement, capture, rafle, promotion ou victoire, répétition et indépendance |

## Contrat provisoire du domaine

- `Position(row, column)` : coordonnées ; la validation 0–9 est encore RED.
- `Piece(owner, king)` et `Player.WHITE/BLACK` : données du camp et de la pièce, sans compte utilisateur.
- `Board(Map<Position, Piece>)` : copie une position explicite. `pieces()` expose une table immuable et `pieceAt` renvoie un `Optional`. `Board.initial()` renvoie encore un plateau vide : US-02 est RED.
- `Move(from, landings)` : origine et chaque arrivée d'un coup complet. Par exemple `(6,1) → (4,3) → (2,5)` représente deux sauts, jamais deux commandes de joueurs distincts.
- `Game(Board, Player)` : assemble une fixture. `Game()` décrit le départ prévu (blancs, plateau initial encore vide). `board()`, `currentPlayer()` et `status()` exposent l'état ; `play` et `reset` sont encore des stubs explicites.
- `GameRules.legalMoves(Board, Player)` : devra fournir tous les parcours complets légaux après obligation et maximum global. La liste est vide actuellement.
- `GameRules.status(Board, Player)` : devra évaluer le camp devant jouer ; retourne encore `IN_PROGRESS`.
- `GameStatus` : `IN_PROGRESS`, `WHITE_WON`, `BLACK_WON`, selon le périmètre victoire retenu.

`DameTestSupport` appartient uniquement aux tests. Il construit des positions littérales, sans calculer les coups légaux. Les deux assertions communes vérifient l'acceptation ou un refus `IllegalArgumentException` ; chaque refus vérifie que plateau, tour et statut sont conservés. Les tests positifs transforment également une commande non implémentée en échec d'assertion lisible. Le placement initial attendu est une table explicite partagée entre US-02 et US-12.

Les scénarios de coordonnées hors limites englobent la construction de la commande dans l'assertion : ils acceptent un refus lors de la construction de Position, sans prétendre mesurer une branche interne du moteur. L'origine nulle reste une donnée invalide à refuser par la commande de jeu dans le contrat actuel.

## Règles et décisions de périmètre

Les détails des rafles et promotions ont été vérifiés dans l'[annexe officielle FMJD](https://www.fmjd.org/docs/Annex_1.pdf), articles 3.5–3.9 et 4.1–4.15 : capture avant/arrière des pions, dames volantes, maximum de pièces, libre choix à égalité, retrait à la fin et absence de promotion intermédiaire. Les conventions de coordonnées sont celles du backlog.

- Les nulles internationales restent une décision à spécifier avant de déclarer US-11 terminée ; aucune règle de répétition ou compteur inventée dans cette suite.
- Le sort d'un pion artificiellement placé sur sa propre rangée de promotion avant tout coup n'était pas défini : ni rejet ni normalisation implicite imposé. Les promotions testées résultent de coups légaux.
- Pas d'IA, multijoueur réseau, score, sauvegarde SDK ou API ajouté.

## Commandes

```bash
# Compilation seule : doit réussir pendant RED
mvn -f backend/pom.xml -DskipTests test-compile

# Une US à la fois ; échec attendu tant que son comportement manque
mvn -f backend/pom.xml -Dtest=InitialPlacementTest test
mvn -f backend/pom.xml -Dtest=SingleCaptureTest test

# Domaine entier
mvn -f backend/pom.xml '-Dtest=fr.tikigaming.games.dame.*Test' test

# Formatage puis contrôle complet (verify sera rouge pendant RED)
mvn -f backend/pom.xml spotless:apply
mvn -f backend/pom.xml spotless:check verify
```

Rapports dans `backend/target/surefire-reports/`. La prochaine phase doit implémenter uniquement les règles nécessaires, sans affaiblir les assertions ni ignorer les tests avancés. Aucun nouveau commit, push ou PR effectué pendant cette préparation.
