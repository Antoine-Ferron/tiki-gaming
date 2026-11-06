# language: fr
Fonctionnalité: Une ville identique pour tous (R1) et son GPS
  En tant que joueur
  Je veux une ville générée à partir d'une graine fixe, et un GPS qui me mène à destination
  Afin de me repérer dans la même ville que tous les autres joueurs

  Scénario: Deux joueurs reçoivent la même ville
    Étant donné deux joueurs
    Quand chacun charge la ville
    Alors ils reçoivent la même ville
    Et cette ville vient de la graine 1337

  Scénario: La ville compte quatre donneurs de missions
    Étant donné deux joueurs
    Quand chacun charge la ville
    Alors la ville compte 4 donneurs de missions

  Scénario: Le GPS mène exactement à la destination
    Étant donné un joueur au point (0, 0)
    Quand il demande au GPS d'aller en (200, -150)
    Alors l'itinéraire passe par plusieurs points
    Et l'itinéraire se termine en (200, -150)

  Scénario: Le GPS refuse une destination illisible
    Étant donné un joueur au point (0, 0)
    Quand il demande au GPS d'aller en (abc, -150)
    Alors le GPS refuse la destination
