# language: fr
Fonctionnalité: Déplacement du maki
  Pour grimper le baobab
  En tant que joueur
  Je dirige à gauche ou à droite un maki qui rebondit tout seul de branche en branche

  # EF-1.2
  Scénario: Le maki rebondit sur une branche touchée en descendant
    Étant donné une branche normale sous le maki
    Et le maki qui descend vers elle
    Quand le temps avance d'une image
    Alors le maki repart vers le haut à la vitesse d'un saut normal

  # EF-1.3
  Scénario: Le maki traverse une branche en montant
    Étant donné une branche normale juste au-dessus du maki
    Et le maki qui monte
    Quand le temps avance de 10 images
    Alors le maki est au-dessus de la branche
    Et il n'a pas rebondi

  # EF-1.4 et EF-1.5 : le maki parcourt 5 px par image, l'écran fait 360 px de large.
  Plan du scénario: Le joueur dirige le maki, et les bords sont reliés
    Étant donné le maki à <départ> px du bord gauche
    Quand le joueur le dirige <direction> pendant une image
    Alors le maki est à <arrivée> px du bord gauche

    Exemples:
      | départ | direction | arrivée |
      | 100    | nulle part | 100    |
      | 10     | à gauche  | 5       |
      | 5      | à gauche  | 0       |
      | 4      | à gauche  | 359     |
      | 354    | à droite  | 359     |
      | 355    | à droite  | 0       |
