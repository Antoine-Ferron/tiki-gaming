# language: fr
Fonctionnalité: Tirs et victoire en bataille navale
  Pour qu'une partie se déroule équitablement
  En tant que joueur
  Je veux que mes tirs soient comptés correctement et que la partie se termine quand je coule
  toute la flotte adverse

  Contexte:
    Soit une flotte adverse composée d'un unique Torpilleur occupant les cases (0,0) et (0,1)

  Scénario: Un tir dans l'eau ne coule aucun navire et la partie continue
    Quand je tire sur la case (5,5)
    Alors le tir est à l'eau
    Et la partie continue

  Scénario: Toucher une des cases d'un navire le touche sans le couler s'il reste une case intacte
    Quand je tire sur la case (0,0)
    Alors le tir touche le Torpilleur
    Et le Torpilleur n'est pas encore coulé
    Et la partie continue

  Scénario: Toucher toutes les cases d'un navire le coule
    Quand je tire sur la case (0,0)
    Et je tire sur la case (0,1)
    Alors le Torpilleur est coulé

  Scénario: Couler le dernier navire de la flotte adverse termine la partie et soumet le score
    Quand je tire sur la case (0,0)
    Et je tire sur la case (0,1)
    Alors la partie est terminée
    Et un score est soumis une seule fois

  Scénario: Tirer deux fois sur la même case ne compte qu'une fois
    Quand je tire sur la case (0,0)
    Et je tire de nouveau sur la case (0,0)
    Alors le second tir est compté comme répété
    Et un seul tir a été enregistré contre la flotte adverse
