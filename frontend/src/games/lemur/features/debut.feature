# language: fr
Fonctionnalité: Début de partie
  Pour commencer chaque ascension dans les mêmes conditions
  En tant que joueur
  Je veux partir du pied du baobab, la fossa encore loin sous moi

  # EF-1.1, EF-3.1, EF-5.1
  Scénario: Une partie commence au pied du baobab
    Quand une nouvelle partie commence
    Alors le maki est à 0 m, sur une branche centrée sous lui
    Et le bas de l'écran est à 0 m
    Et la fossa attend 40 m sous le bas de l'écran
    Et des branches attendent jusqu'à au moins 128 m
    Et le score est de 0

  # EF-1.1, EF-1.2 : le maki repart dès la première image, sans commande du joueur.
  Scénario: Le maki rebondit tout de suite sur sa première branche
    Étant donné une nouvelle partie
    Quand la partie avance de 2 images
    Alors le maki repart vers le haut à la vitesse d'un saut normal
