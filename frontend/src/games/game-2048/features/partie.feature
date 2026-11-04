# language: fr
Fonctionnalité: Une partie de 2048
  Pour atteindre la tuile 2048
  En tant que joueur
  Je veux faire glisser les tuiles et voir celles de même valeur fusionner

  # Une case vide est notée « . ». Les nouvelles tuiles sont tirées par un hasard fixé par le test.

  Plan du scénario: Les tuiles glissent et fusionnent une seule fois par coup
    Étant donné une ligne "<avant>"
    Quand le joueur la fait glisser vers la <direction>
    Alors la ligne devient "<après>"
    Et le coup rapporte <points> points

    Exemples:
      | avant    | direction | après    | points |
      | . 2 . 2  | gauche    | 4 . . .  | 4      |
      | 2 2 2 2  | gauche    | 4 4 . .  | 8      |
      | 2 2 2 .  | gauche    | 4 2 . .  | 4      |
      | 2 2 2 .  | droite    | . . 2 4  | 4      |
      | 2 2 4 4  | gauche    | 4 8 . .  | 12     |
      | 4 4 8 .  | gauche    | 8 8 . .  | 8      |
      | 2 4 8 16 | gauche    | 2 4 8 16 | 0      |

  Scénario: Un coup qui bouge des tuiles fait apparaître une nouvelle tuile
    Étant donné la grille
      """
      2 . . .
      . . . .
      . . . .
      . . . .
      """
    Et que la prochaine tuile sera un 2 sur la dernière case vide
    Quand le joueur joue vers la droite
    Alors la grille devient
      """
      . . . 2
      . . . .
      . . . .
      . . . 2
      """
    Et le score est de 0 points

  Scénario: Un coup qui ne bouge aucune tuile ne compte pas
    Étant donné la grille
      """
      2 . . .
      4 . . .
      . . . .
      . . . .
      """
    Quand le joueur joue vers la gauche
    Alors la grille ne change pas
    Et aucune nouvelle tuile n'apparaît
    Et le score est de 0 points

  Scénario: Le score additionne les points de chaque coup
    Étant donné la grille
      """
      2 2 4 4
      . . . .
      . . . .
      . . . .
      """
    Et un score de 100 points
    Quand le joueur joue vers la gauche
    Alors le score est de 112 points

  Scénario: Créer la tuile 2048 fait gagner la partie
    Étant donné la grille
      """
      1024 1024    .    .
         2    .    .    .
         .    .    .    .
         .    .    .    .
      """
    Quand le joueur joue vers la gauche
    Alors la partie est gagnée

  Scénario: Après avoir continué, on ne gagne pas une deuxième fois
    Étant donné une partie déjà gagnée où le joueur a choisi de continuer
    Et la grille
      """
      1024 1024 2048    .
         .    .    .    .
         .    .    .    .
         .    .    .    .
      """
    Quand le joueur joue vers la gauche
    Alors la partie est en cours

  Scénario: Une grille pleine sans fusion possible fait perdre la partie
    Étant donné la grille
      """
      2 4 2 4
      4 2 4 2
      2 4 2 4
      2 4 2 .
      """
    Et que la prochaine tuile sera un 4 sur la dernière case vide
    Quand le joueur joue vers la droite
    Alors la grille devient
      """
      2 4 2 4
      4 2 4 2
      2 4 2 4
      4 2 4 2
      """
    Et la partie est perdue

  Scénario: Une grille pleine avec une fusion possible continue
    Étant donné la grille
      """
      2 4 2 4
      4 2 4 2
      2 4 2 4
      2 4 2 .
      """
    Et que la prochaine tuile sera un 2 sur la dernière case vide
    Quand le joueur joue vers la droite
    Alors la partie est en cours
