# language: fr
Fonctionnalité: Fin d'un niveau
  Pour progresser et me comparer aux autres joueurs
  En tant que joueur connecté
  Je veux que chaque nouveau record soit gardé et compte au classement

  Contexte:
    Soit un joueur connecté
    Et le niveau 1, dont le minimum est de 10 coups

  Scénario: Un nouveau record est gardé et envoyé au classement
    Étant donné que son record sur le niveau 1 est de 800 points
    Quand il termine le niveau 1 en 13 coups
    Alors son record sur le niveau 1 est de 850 points
    Et son score total de 850 points est envoyé au classement

  Scénario: Un record refusé par le classement n'est pas gardé
    Étant donné que le classement refuse le prochain score
    Quand il termine le niveau 1 en 10 coups
    Alors son record sur le niveau 1 n'est pas gardé
    Quand il termine à nouveau le niveau 1 en 10 coups
    Alors son score total de 1000 points est envoyé au classement

  Plan du scénario: Le score d'un niveau dépend des coups en trop et des indices
    Quand il termine le niveau 1 en <coups> coups avec <indices> indice(s)
    Alors son score sur le niveau est de <score>

    Exemples:
      | coups | indices | score  |
      | 9     | 0       | refusé |
      | 10    | 0       | 1000   |
      | 11    | 0       | 950    |
      | 29    | 0       | 50     |
      | 30    | 0       | 0      |
      | 10    | 1       | 800    |
