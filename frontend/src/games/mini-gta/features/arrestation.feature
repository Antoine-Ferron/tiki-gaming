# language: fr
Fonctionnalité: Réapparition en jeu (R7)
  Pour qu'une arrestation coûte plus cher qu'une mort
  En tant que joueur
  Je veux perdre mes armes quand je suis arrêté, et les garder quand je meurs

  Contexte:
    Soit une partie en cours
    Et un joueur armé d'un pistolet et d'un fusil d'assaut

  Scénario: Arrêté, il perd ses armes sauf les poings et sort du commissariat
    Quand il est arrêté
    Alors il n'a plus que les poings
    Et il réapparaît au commissariat

  Scénario: Mort, il garde ses armes et sort de l'hôpital
    Quand il meurt
    Alors il a toujours le pistolet et le fusil d'assaut
    Et il réapparaît à l'hôpital
