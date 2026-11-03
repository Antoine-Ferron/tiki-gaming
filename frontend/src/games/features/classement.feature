# language: fr
Fonctionnalité: Classement d'un jeu
  Pour savoir où je me situe face aux autres joueurs
  En tant que joueur
  Je veux un classement juste, où personne n'est désavantagé à égalité de score

  Scénario: Les joueurs sont classés du meilleur score au moins bon
    Étant donné les meilleurs scores suivants
      | joueur | score |
      | bob    | 10    |
      | alice  | 30    |
      | carl   | 20    |
    Quand le classement est calculé
    Alors le classement est
      | rang | joueur |
      | 1    | alice  |
      | 2    | carl   |
      | 3    | bob    |

  Scénario: Des ex æquo partagent le même rang et le rang suivant est sauté
    Étant donné les meilleurs scores suivants
      | joueur | score |
      | bob    | 50    |
      | alice  | 50    |
      | carl   | 40    |
    Quand le classement est calculé
    Alors le classement est
      | rang | joueur |
      | 1    | alice  |
      | 1    | bob    |
      | 3    | carl   |

  Scénario: Seul le meilleur score de chaque joueur compte
    Étant donné que "alice" a joué des parties à 10, 30 et 20 points
    Et que "bob" a joué une partie à 25 points
    Quand le classement du jeu est affiché
    Alors "alice" est première avec 30 points et 3 parties jouées
    Et "bob" est deuxième avec 25 points
