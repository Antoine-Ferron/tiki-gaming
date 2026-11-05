# language: fr
Fonctionnalité: Plateau et tapis des joueurs
  Pour suivre la partie
  En tant que joueur
  Je veux voir chaque joueur autour du plateau, sans que les rôles secrets fuient

  Plan du scénario: Les tapis sont placés autour du plateau à partir de ma place
    Quand je suis à la place <moi>
    Alors la place <place> est affichée <position>

    Exemples:
      | moi | place | position |
      | 1   | 1     | en bas   |
      | 1   | 2     | à gauche |
      | 1   | 3     | en haut  |
      | 1   | 4     | à droite |
      | 4   | 1     | à gauche |

  Plan du scénario: Chaque tapis montre le personnage, les PV et le nombre de cartes en main
    Étant donné une partie à quatre joueurs où je suis à la place 1
    Quand le plateau est affiché
    Alors le tapis de la place <place> montre "<personnage>", "<pv>" et "<main>"

    Exemples:
      | place | personnage     | pv       | main      |
      | 2     | Calamity Janet | 3/4 PV   | 2 en main |
      | 3     | Paul Regret    | 4/4 PV   | 3 en main |
      | 4     | Willy le Kid   | 4/4 PV   | 4 en main |

  Plan du scénario: Seuls le rôle public du Shérif et mon propre rôle sont visibles
    Étant donné une partie à quatre joueurs où je suis à la place 1
    Quand le plateau est affiché
    Alors le tapis de la place <place> indique "<rôle>"

    Exemples:
      | place | rôle        |
      | 1     | Rôle privé  |
      | 2     | Rôle caché  |
      | 3     | Rôle public |
      | 4     | Rôle caché  |

  Scénario: Une carte posée apparaît sur le tapis de son joueur
    Étant donné une partie à quatre joueurs où je suis à la place 1
    Et une Planque posée devant la place 3
    Quand le plateau est affiché
    Alors le tapis de la place 3 montre la carte posée "Planque"
    Et le tapis de la place 2 n'a aucune carte posée

  Scénario: Je vois ma main, et des autres seulement le nombre de cartes
    Étant donné une partie à quatre joueurs où je suis à la place 1
    Quand le plateau est affiché
    Alors ma main montre "BANG !" et "Raté !"
    Et aucun tapis adverse ne montre de carte de sa main
