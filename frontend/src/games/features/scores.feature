# language: fr
Fonctionnalité: Enregistrement d'un score
  Pour que le classement reste crédible
  En tant que plateforme
  Je n'enregistre que des scores possibles, et je ne perds pas le score d'un joueur dont la connexion coupe

  Contexte:
    Soit un jeu dont le score maximal est 300
    Et un joueur connecté

  Plan du scénario: Un score est accepté seulement entre 0 et le maximum du jeu
    Quand le joueur termine une partie avec un score de <score>
    Alors le score est <résultat>

    Exemples:
      | score | résultat |
      | -1    | refusé   |
      | 0     | accepté  |
      | 1     | accepté  |
      | 299   | accepté  |
      | 300   | accepté  |
      | 301   | refusé   |
      | 12.5  | refusé   |

  Scénario: Un score refusé explique pourquoi au joueur
    Quand le joueur termine une partie avec un score de 301
    Alors il voit le message "Score refusé : 300 au maximum pour ce jeu."

  Scénario: Un score envoyé pendant une coupure réseau n'est pas perdu
    Étant donné que la connexion est coupée
    Quand le joueur termine une partie avec un score de 120
    Alors il voit le message "Connexion perdue : ton score est gardé sur cet appareil et sera envoyé à ta prochaine partie."
    Et aucun score n'est encore enregistré
    Quand la connexion revient et qu'il termine une partie avec un score de 80
    Alors les scores 120 et 80 sont enregistrés
