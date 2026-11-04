# language: fr
Fonctionnalité: Révélation des cases et fin de partie
  En tant que joueur
  Je veux révéler des cases et poser des drapeaux
  Afin de gagner la partie sans tomber sur une mine

  Contexte:
    Étant donné une grille 3×3 avec une seule mine, en haut à gauche

  Plan du scénario: Le résultat de la partie dépend de la case révélée
    Quand je révèle la case (<ligne>, <colonne>)
    Alors la partie est <résultat>

    Exemples:
      | ligne | colonne | résultat |
      | 0     | 0       | perdue   |
      | 1     | 1       | en cours |
      | 2     | 2       | gagnée   |

  Scénario: Révéler une case vide déclenche une cascade
    Quand je révèle la case (2, 2)
    Alors les 8 cases sans mine sont révélées

  Scénario: Un drapeau empêche la révélation
    Étant donné que je pose un drapeau sur la case (0, 0)
    Quand je révèle la case (0, 0)
    Alors la case (0, 0) n'est pas révélée
    Et la partie n'est pas perdue

  Scénario: Retirer un drapeau permet à nouveau la révélation
    Étant donné que je pose un drapeau sur la case (1, 1)
    Et je retire le drapeau de la case (1, 1)
    Quand je révèle la case (1, 1)
    Alors la case (1, 1) est révélée

  Scénario: Révéler une case déjà révélée ne fait rien
    Étant donné que je révèle la case (1, 1)
    Quand je révèle à nouveau la case (1, 1)
    Alors la partie n'est pas perdue
