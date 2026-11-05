# Journal TDD — Tic-Tac-Toe

Le moteur a été développé par incréments courts Red-Green-Refactor. Les commits
de la branche `game/tic-tac-toe/interface-jouable` constituent la preuve
historique ; chaque étape a conservé les tests précédents.

| Cycle | Attente                                        | Preuve rouge/verte                                                                 | Refactor                     |
| ----- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- |
| 1     | Grille 3×3 vide et X commence                  | `startsWithAnEmptyThreeByThreeBoardAndXTurn`                                       | Constantes et état initial   |
| 2     | Placement et alternance X/O                    | `alternatesPlayersAfterEachValidMove`                                              | Méthode `otherPlayer`        |
| 3     | Coordonnées invalides et case occupée refusées | `rejectsOutsideCoordinatesAndOccupiedCells`                                        | Validation centralisée       |
| 4     | Victoires ligne, colonne et diagonale          | `detectsAHorizontalWin`, `detectsAVerticalWin`, `detectsADiagonalWin`              | Détection commune des lignes |
| 5     | Match nul et fin de partie                     | `detectsADrawWhenTheBoardIsFullWithoutAWinner`, `rejectsMovesAfterTheGameHasEnded` | Statuts explicites           |

La reproduction complète du rouge initial dépend de l'historique Git de la
branche ; elle doit être montrée depuis les commits et non reconstruite par un
test artificiellement cassé.
