# language: fr
# Spécification : docs/games/echecs/regles.md (règles D1 à D7). Critères d'acceptation de l'issue #5.
@echecs @deplacements
Fonctionnalité: Déplacements des pièces
  En tant que joueur d'échecs
  Je veux que le jeu connaisse les cases où chaque pièce peut aller
  Afin de ne pouvoir jouer que des coups conformes aux règles

  Scénario: Un cavalier dans un coin n'a que deux cases
    Étant donné la position "k7/8/8/8/8/8/8/N6K w - - 0 1"
    Quand je regarde les cases accessibles depuis "a1"
    Alors les cases accessibles sont "b3, c2"

  Scénario: Une tour s'arrête avant une pièce de son camp et sur une pièce adverse
    Étant donné la position "k7/8/8/8/8/8/P7/Rn5K w - - 0 1"
    Quand je regarde les cases accessibles depuis "a1"
    Alors les cases accessibles sont "b1"

  Plan du Scénario: Le pion avance tout droit et prend en diagonale (<situation>)
    Étant donné la position "<position>"
    Quand je regarde les cases accessibles depuis "<depart>"
    Alors les cases accessibles sont "<cases>"

    Exemples:
      | situation                              | position                          | depart | cases      |
      | double pas depuis la rangée de départ  | k7/8/8/8/8/8/4P3/7K w - - 0 1     | e2     | e3, e4     |
      | prise des pièces adverses              | k7/8/8/3n1b2/4P3/8/8/7K w - - 0 1 | e4     | d5, e5, f5 |
      | pas de prise d'une pièce de son camp   | k7/8/8/3N4/4P3/8/8/7K w - - 0 1   | e4     | e5         |
      | le pion noir descend                   | k7/4p3/3N1n2/8/8/8/8/7K b - - 0 1 | e7     | d6, e5, e6 |

  Scénario: Un pion bloqué par une pièce ne peut pas avancer
    Étant donné la position "k7/8/8/8/8/4n3/4P3/7K w - - 0 1"
    Quand je regarde les cases accessibles depuis "e2"
    Alors aucune case n'est accessible

  # Écrit d'avance mardi (tag @en-cours), activé jeudi quand la règle L2 (coups légaux) a été codée : double boucle BDD.
  Scénario: Une pièce clouée devant son roi ne peut pas quitter la ligne
    Étant donné la position "4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1"
    Quand je regarde les cases accessibles depuis "e2"
    Alors aucune case n'est accessible
