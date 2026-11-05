# language: fr
Fonctionnalité: Déroulement de mon tour
  Pour savoir quoi faire
  En tant que joueur
  Je veux que le plateau m'indique l'étape en cours et me laisse défausser quand c'est nécessaire

  Plan du scénario: Le plateau m'indique quoi faire selon la phase et mes cartes
    Étant donné que c'est à la place <actif> de jouer, en phase <phase>, avec <main> cartes en main
    Quand je regarde le plateau depuis la place 1
    Alors le plateau m'indique "<message>"

    Exemples:
      | actif | phase   | main | message                                                              |
      | 2     | PLAY    | 3    | Au tour de la place 2.                                               |
      | 1     | DRAW    | 3    | À toi de jouer : pioche tes deux cartes.                             |
      | 1     | PLAY    | 3    | À toi de jouer : choisis un BANG ! et ta cible, ou termine ton tour. |
      | 1     | DISCARD | 6    | Tu as trop de cartes : défausse-en jusqu'à 4.                        |
      | 1     | DISCARD | 4    | Tu as défaussé assez de cartes : finis ton tour.                     |

  Scénario: En phase de défausse, je défausse la carte que je choisis
    Étant donné que c'est à la place 1 de jouer, en phase DISCARD
    Quand je défausse "Raté !"
    Alors la défausse de la carte "MISSED-1" est demandée

  Scénario: Hors phase de défausse, mes cartes ne se défaussent pas
    Étant donné que c'est à la place 1 de jouer, en phase PLAY
    Quand je regarde le plateau depuis la place 1
    Alors aucune carte de ma main ne peut être défaussée

  Scénario: Je pioche en cliquant sur la pioche du plateau
    Étant donné que c'est à la place 1 de jouer, en phase DRAW
    Quand je clique sur la pioche
    Alors la pioche est demandée

  Scénario: Hors de ma phase de pioche, la pioche n'est pas cliquable
    Étant donné que c'est à la place 1 de jouer, en phase PLAY
    Quand je regarde le plateau depuis la place 1
    Alors la pioche n'est pas cliquable

  Scénario: Je finis mon tour depuis ma main
    Étant donné que c'est à la place 1 de jouer, en phase PLAY
    Quand je clique sur "Finir le tour"
    Alors la fin du tour est demandée

  Scénario: Pendant ma phase de pioche, je ne peux pas finir mon tour
    Étant donné que c'est à la place 1 de jouer, en phase DRAW
    Quand je regarde le plateau depuis la place 1
    Alors le bouton "Finir le tour" n'est pas proposé
