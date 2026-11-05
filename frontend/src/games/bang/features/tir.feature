# language: fr
Fonctionnalité: Jouer un BANG ! depuis ma main
  Pour tirer sur un adversaire
  En tant que joueur
  Je veux choisir un BANG ! puis ma cible, seulement quand c'est à moi de jouer

  Plan du scénario: Je ne peux choisir un BANG ! que pendant ma phase de jeu
    Étant donné que c'est à la place <actif> de jouer, en phase <phase>
    Quand le plateau est affiché pour la place 1
    Alors je peux choisir un BANG ! : <possible>

    Exemples:
      | actif | phase   | possible |
      | 1     | PLAY    | oui      |
      | 1     | DRAW    | non      |
      | 1     | DISCARD | non      |
      | 2     | PLAY    | non      |

  Scénario: Choisir un BANG ! puis une cible déclenche le tir
    Étant donné que c'est à la place 1 de jouer, en phase PLAY
    Quand je choisis le premier BANG ! de ma main
    Et je vise la place 2
    Alors le tir est demandé avec la carte "BANG-1" sur la place 2

  Scénario: Un adversaire éliminé ne peut pas être visé
    Étant donné que c'est à la place 1 de jouer, en phase PLAY
    Et la place 3 est éliminée
    Quand je choisis le premier BANG ! de ma main
    Alors je peux viser les places 2 et 4, mais pas la place 3
