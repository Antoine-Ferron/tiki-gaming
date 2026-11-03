# language: fr
#
# Atelier « 3 amigos » (métier, développement, test) : règles retenues, exemples et questions tranchées.
#   Règle    : on ne construit qu'une carte payable, et jamais deux fois la même.
#   Exemple  : sans pierre, les Bains (1 pierre) s'achètent 2 pièces au voisin qui en produit.
#   Question : et si aucun voisin ne produit la ressource ? → la carte est refusée.
#   Question : et une carte qui n'est pas dans sa main ? → refusée aussi.
#   Question : et deux exemplaires de la même carte dans une main ? → en jouer un laisse l'autre.
#   Règle    : défausser une carte rapporte 3 pièces.
#   Règle    : les mains passent au voisin de gauche aux âges I et III, de droite à l'âge II.
#   Règle    : en fin d'âge, chaque joueur affronte ses deux voisins (victoire +1 / +3 / +5, défaite −1).
#   Question : et en cas d'égalité de boucliers ? → aucun jeton.
#   Règle    : après l'âge III, le plus haut total gagne ; à égalité, celui qui a le plus de pièces.
#
# Les scénarios décrivent les règles, jamais l'interface (pas de clic ni de bouton) : ils restent vrais
# quand l'écran change. Une règle par scénario, des exemples concrets plutôt que des étapes techniques.
Fonctionnalité: Partie contre les IA
  Pour jouer une vraie partie sans attendre le multijoueur
  En tant que joueur
  Je construis ma civilisation tour après tour face à deux IA

  Contexte:
    Soit une partie entre "alice", "IA 1" et "IA 2"

  Scénario: Construire une carte gratuite
    Quand "alice" construit "Chantier"
    Alors "alice" produit du bois
    Et "alice" a 1 pièce

  Scénario: Acheter la ressource manquante à un voisin
    Soit "IA 1" qui produit de la pierre et "alice" qui a 3 pièces
    Quand "alice" construit "Bains"
    Alors "alice" a payé 2 pièces à "IA 1" pour 1 pierre

  Plan du scénario: Une carte impossible à construire est refusée
    Soit "alice" qui a <pièces> pièce et a construit "<déjà construite>"
    Quand "alice" essaie de construire "<carte>"
    Alors l'action est refusée : "<raison>"

    Exemples:
      | pièces | déjà construite | carte    | raison                                       |
      | 1      | Chantier        | Chantier | Tu as déjà construit cette carte.            |
      | 1      | aucune          | Bains    | Il te manque des ressources.                 |
      | 0      | aucune          | Filon    | Pas assez de pièces.                         |
      | 1      | aucune          | Aqueduc  | Cette carte n'est pas dans ta main : Aqueduc |

  Scénario: Défausser une carte rapporte 3 pièces
    Quand "alice" défausse "Bains"
    Alors "alice" a 4 pièces

  Scénario: Jouer un exemplaire d'une carte laisse l'autre dans la main
    Soit "alice" qui a deux "Chantier" en main
    Quand "alice" défausse "Chantier"
    Alors la main transmise à "IA 2" contient encore un "Chantier"

  Plan du scénario: Les mains passent au voisin selon l'âge
    Soit la partie à l'âge <âge>
    Quand chaque joueur défausse une carte différente
    Alors "alice" reçoit la main de "<voisin>"

    Exemples:
      | âge | voisin |
      | 1   | IA 1   |
      | 2   | IA 2   |

  Scénario: Les conflits militaires sont résolus à la fin de l'âge
    Soit "alice" qui a construit "Palissade"
    Quand l'âge I se termine
    Alors les jetons militaires sont alice 2, IA 1 -1 et IA 2 -1
    Et l'âge II commence avec 7 cartes en main

  Scénario: La partie se termine après l'âge III avec un classement
    Quand les IA jouent les trois âges à la place de chaque joueur
    Alors la partie est terminée
    Et le classement est trié par score puis par pièces
