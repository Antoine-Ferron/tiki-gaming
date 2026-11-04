# language: fr
Fonctionnalité: Une ville identique pour tous (R1) et son GPS
  Pour que tous les joueurs se repèrent dans la même ville
  En tant que joueur
  Je veux une ville générée à partir d'une graine fixe, et un GPS qui me mène à destination

  Scénario: Deux joueurs reçoivent la même ville
    Quand un premier joueur charge la ville
    Et un second joueur charge la ville
    Alors les deux villes sont identiques
    Et la ville est générée avec la graine 1337

  Scénario: La ville compte quatre donneurs de missions
    Quand un premier joueur charge la ville
    Alors la ville compte 4 donneurs de missions

  Scénario: Le GPS mène exactement à la destination
    Quand il demande l'itinéraire de (0, 0) à (200, -150)
    Alors l'itinéraire passe par plusieurs points
    Et l'itinéraire se termine en (200, -150)

  Scénario: Le GPS refuse une coordonnée invalide
    Quand il demande l'itinéraire de (0, 0) à (abc, -150)
    Alors la demande est refusée avec le code 400
