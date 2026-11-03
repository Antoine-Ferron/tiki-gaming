# language: fr
Fonctionnalité: Classement d'un jeu
  Pour savoir où je me situe face aux autres joueurs,
  en tant que joueur, je veux un classement par meilleur score
  où des joueurs à égalité partagent le même rang.

  Scénario: Le meilleur score de chaque joueur est classé du plus haut au plus bas
    Soit les parties suivantes sur le Clicker
      | joueur | score |
      | alice  | 10    |
      | bob    | 25    |
      | alice  | 30    |
    Quand le classement est calculé
    Alors le classement affiché est
      | rang | joueur | meilleur score |
      | 1    | alice  | 30             |
      | 2    | bob    | 25             |

  Scénario: Des ex æquo partagent leur rang et le rang suivant est sauté
    Soit les parties suivantes sur le Clicker
      | joueur | score |
      | bob    | 50    |
      | alice  | 50    |
      | carl   | 40    |
    Quand le classement est calculé
    Alors le classement affiché est
      | rang | joueur | meilleur score |
      | 1    | alice  | 50             |
      | 1    | bob    | 50             |
      | 3    | carl   | 40             |
