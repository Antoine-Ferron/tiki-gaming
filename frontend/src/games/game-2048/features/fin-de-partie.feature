# language: fr
Fonctionnalité: Fin d'une partie
  Pour me comparer aux autres joueurs
  En tant que joueur
  Je veux que mon score compte au classement et que mon record soit gardé

  Scénario: Le score d'un joueur connecté est envoyé au classement
    Étant donné un joueur connecté
    Quand il termine une partie avec un score de 1200 points
    Alors un score de 1200 points est envoyé au classement
    Et son record est de 1200 points

  Scénario: Une partie moins bonne ne fait pas baisser le record
    Étant donné un joueur connecté
    Et son record actuel est de 500 points
    Quand il termine une partie avec un score de 300 points
    Alors un score de 300 points est envoyé au classement
    Et son record est de 500 points

  Scénario: Un invité garde son record sans apparaître au classement
    Étant donné un invité
    Quand il termine une partie avec un score de 800 points
    Alors aucun score n'est envoyé au classement
    Et son record est de 800 points

  Scénario: Un score refusé par le classement ne devient pas le record
    Étant donné un joueur connecté
    Et que le classement refuse le prochain score
    Quand il termine une partie avec un score de 900 points
    Alors il voit le message d'erreur du classement
    Et il n'a pas encore de record

  Scénario: Pendant une coupure réseau, le record est gardé et le score sera envoyé plus tard
    Étant donné un joueur connecté
    Et que la connexion est coupée
    Quand il termine une partie avec un score de 700 points
    Alors il est prévenu que son score sera envoyé plus tard
    Et son record est de 700 points
