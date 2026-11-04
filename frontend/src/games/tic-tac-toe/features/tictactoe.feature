# language: fr
Fonctionnalité: Partie de Tic-Tac-Toe
  Pour jouer une partie équitable
  En tant que joueur
  Je veux que les règles du Tic-Tac-Toe soient appliquées

  Scénario: Une partie commence avec X et alterne les joueurs
    Étant donné une nouvelle partie
    Alors le joueur courant est X
    Et toutes les cases sont vides
    Quand X joue en ligne 1 colonne 1
    Alors le joueur courant est O
    Et la case ligne 1 colonne 1 contient X

  Scénario: Une case occupée ou des coordonnées invalides sont refusées
    Étant donné une nouvelle partie
    Quand X joue en ligne 1 colonne 1
    Alors jouer en ligne 1 colonne 1 est refusé
    Et jouer en ligne 0 colonne 1 est refusé

  Plan du scénario: Une ligne, colonne ou diagonale donne la victoire
    Étant donné une nouvelle partie
    Quand les coups suivants sont joués: <coups>
    Alors le statut de la partie est <statut>

    Exemples:
      | coups                                      | statut |
      | 1,1; 2,1; 1,2; 2,2; 1,3                    | X_WON  |
      | 1,1; 1,2; 2,1; 2,2; 3,1                    | X_WON  |
      | 1,1; 1,2; 2,2; 1,3; 3,3                    | X_WON  |

  Scénario: Une grille pleine sans ligne gagnante est un match nul
    Étant donné une nouvelle partie
    Quand les coups suivants sont joués: 1,1; 1,2; 1,3; 2,2; 2,1; 2,3; 3,2; 3,1; 3,3
    Alors le statut de la partie est DRAW
