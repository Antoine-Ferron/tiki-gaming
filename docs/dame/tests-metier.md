# Suite de spécification métier — US-01 à US-12

Le 3 novembre 2026, l'utilisateur a demandé tous les tests avant l'implémentation, puis le passage complet au GREEN. Le moteur Java pur satisfait maintenant les 224 cas métier de la suite. Le frontend reste une page d'attente sans raccordement au moteur ; les tests d'intégration HTTP et E2E React restent prévus dans la stratégie, avec leur contrat technique à valider. Ces résultats ne déclarent pas l'issue #18 terminée.

## Résultats observés

- **224 cas métier réussis** dans 13 classes JUnit 5, avec tests paramétrés.
- **0 échec**, **0 erreur**, **0 test ignoré**.
- Les **18 tests collectifs restent verts**, soit **242 cas réussis au total**.
- Compilation, Spotless et Checkstyle réussis ; `mvn verify` se termine avec `BUILD SUCCESS`.
- Aucun test `@Disabled`, aucun `fail()` artificiel, aucune dépendance ajoutée, aucun mock dans le domaine.

Le commit `2c03072` conserve le RED initial : 220 cas métier, dont 191 échecs et 29 réussites. Les 220 cas initiaux ont d'abord tous passé sans modifier leurs assertions. Une relecture a ensuite identifié le statut incorrect d'une partie reconstruite alors que le camp au trait n'avait plus de pièce ou était bloqué : quatre cas de régression supplémentaires ont été observés RED, puis le constructeur de Game a été corrigé. Les 224 cas passent désormais. Aucun pourcentage de couverture n'est déduit de ces résultats.

## Index de la suite GREEN

Les nombres comptent les invocations paramétrées, et non seulement les méthodes `@Test`.

| US | Classes dans `backend/src/test/java/fr/tikigaming/games/dame/` | Cas | RED | Principaux comportements |
|---|---|---:|---:|---|
| 01 | `BoardTest`, `PositionTest` | 42 | 0 | Dimensions, vide, parité, coins, bornes, refus des cases claires occupées, snapshots |
| 02 | `InitialPlacementTest` | 13 | 0 | 40 pions, 20/20, positions exactes, centre vide, aucun pion promu |
| 03 | `TurnManagementTest` | 4 | 0 | Blancs d'abord, alternance, pièce adverse, double tour refusé |
| 04 | `SimpleMovementTest` | 8 | 0 | Deux camps, deux diagonales avant, bords, occupation et effectifs |
| 05 | `InvalidMoveTest` | 26 | 0 | Origine vide, mauvaise direction/distance, obstacles, routes et commandes invalides, atomicité |
| 06 | `SingleCaptureTest` | 15 | 0 | Quatre directions pour chaque camp, alliés, arrivée occupée, capture au bord |
| 07 | `MandatoryCaptureTest` | 6 | 0 | Obligation globale, autre pièce, prise arrière, absence de capture |
| 08 | `MultipleCaptureTest` | 17 | 0 | Rafles complètes, maximum global et par branche, égalités, double prise, retour à l'origine |
| 09 | `PromotionTest` | 21 | 0 | Deux camps, arrivée finale, passage puis sortie, aucune dame volante pendant la rafle |
| 10 | `KingMovementTest` | 45 | 0 | Distances 1–9, obstacles, captures volantes, arrivées, majorité, retrait différé, boucles |
| 11 | `GameEndTest` | 17 | 0 | Élimination, blocage, coup restant, statut après coup complet et dès la reconstruction, état terminal |
| 12 | `GameResetTest` | 10 | 0 | Après mouvement, capture, rafle, promotion ou victoire, répétition et indépendance |

## Contrat courant du domaine

- `Position(row, column)` : coordonnées immuables ; le constructeur refuse une ligne ou colonne hors de 0–9 par `IllegalArgumentException`.
- `Piece(owner, king)` et `Player.WHITE/BLACK` : données du camp et de la pièce, sans compte utilisateur.
- `Board(Map<Position, Piece>)` : copie une position explicite et refuse une pièce sur une case claire. `pieces()` expose une table immuable et `pieceAt` renvoie un `Optional`. `isEmpty` et `isPlayable` valident les coordonnées via Position. `Board.initial()` construit les 40 pions sur leurs cases de départ, sans dame.
- `Move(from, landings)` : origine et chaque arrivée d'un coup complet. Par exemple `(6,1) → (4,3) → (2,5)` représente deux sauts, jamais deux commandes de joueurs distincts.
- `Game(Board, Player)` : reconstruit une partie et évalue immédiatement le statut du camp devant jouer, y compris l'absence de pièces ou le blocage. `Game()` commence avec le placement initial et les blancs au trait. `play` refuse les parties terminées, applique le coup puis calcule le camp et le statut suivants avant toute affectation. `reset` recrée la position initiale et le tour blanc, sans modifier les anciens plateaux.
- `GameRules.legalMoves(Board, Player)` : fournit les parcours complets légaux en imposant la capture et le maximum global de prises ; les déplacements ordinaires ne sont proposés qu'en l'absence de capture.
- `GameRules.apply(Board, Player, Move)` : méthode interne au package qui valide le coup par la liste des coups légaux et retourne un nouveau Board. Les pièces prises restent bloquantes pendant le parcours, sont retirées à la fin et la promotion dépend de la dernière arrivée. Un coup refusé lève `IllegalArgumentException`.
- `GameRules.status(Board, Player)` : évalue le camp devant jouer ; renvoie `IN_PROGRESS` s'il dispose d'un coup légal, sinon la victoire adverse.
- `GameStatus` : `IN_PROGRESS`, `WHITE_WON`, `BLACK_WON`, selon le périmètre victoire retenu.

`DameTestSupport` appartient uniquement aux tests. Il construit des positions littérales, sans calculer les coups légaux. Les deux assertions communes vérifient l'acceptation ou un refus `IllegalArgumentException` ; chaque refus vérifie que plateau, tour et statut sont conservés. Les tests positifs vérifient que les commandes attendues ne lèvent pas d'exception. Le placement initial attendu est une table explicite partagée entre US-02 et US-12.

Les scénarios de coordonnées hors limites englobent la construction de la commande dans l'assertion : ils acceptent un refus lors de la construction de Position, sans prétendre mesurer une branche interne du moteur. L'origine nulle est refusée par la commande de jeu.

## Règles et décisions de périmètre

Les détails des rafles et promotions ont été vérifiés dans l'[annexe officielle FMJD](https://www.fmjd.org/docs/Annex_1.pdf), articles 3.5–3.9 et 4.1–4.15 : capture avant/arrière des pions, dames volantes, maximum de pièces, libre choix à égalité, retrait à la fin et absence de promotion intermédiaire. Les conventions de coordonnées sont celles du backlog.

- Les nulles internationales restent une décision à spécifier avant de déclarer US-11 terminée ; aucune règle de répétition ou compteur inventée dans cette suite.
- Le sort d'un pion artificiellement placé sur sa propre rangée de promotion avant tout coup n'était pas défini : ni rejet ni normalisation implicite imposé. Les promotions testées résultent de coups légaux.
- Pas d'IA, multijoueur réseau, score, sauvegarde SDK ou API ajouté.

## Commandes

```bash
# Compilation seule
mvn -f backend/pom.xml -DskipTests test-compile

# Une US à la fois : toutes ces commandes sont désormais vertes
mvn -f backend/pom.xml -Dtest=BoardTest,PositionTest test
mvn -f backend/pom.xml -Dtest=InitialPlacementTest test
mvn -f backend/pom.xml -Dtest=SingleCaptureTest test

# Domaine entier
mvn -f backend/pom.xml '-Dtest=fr.tikigaming.games.dame.*Test' test

# Formatage puis contrôle complet : 242 cas verts
mvn -f backend/pom.xml spotless:apply
mvn -f backend/pom.xml spotless:check verify
```

Rapports dans `backend/target/surefire-reports/`. Les suites ciblées et le contrôle complet passent, sans affaiblir les assertions ni ignorer de tests. Le commit local RED `2c03072` reste conservé. Les modifications GREEN du moteur et les quatre régressions supplémentaires sont regroupées dans le commit autorisé `feat(dame): implémente le moteur de dames internationales (#18)`. Aucun push ni PR. Le raccordement React/SDK/API, les tests d'intégration/E2E et les décisions sur les nulles restent à traiter avant la livraison.
