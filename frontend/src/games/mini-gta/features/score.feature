# language: fr
Fonctionnalité: Score envoyé au classement (R8)
  Pour que le classement reflète ma meilleure partie
  En tant que joueur connecté
  Je veux que l'argent gagné soit envoyé comme score, plafonné, seulement quand il bat le précédent

  Plan du scénario: Le score envoyé est l'argent gagné, seulement s'il bat le dernier envoyé
    Étant donné un joueur connecté dont le dernier score envoyé est de <dernier> $
    Quand sa progression est sauvegardée avec <gagné> $ gagnés
    Alors le classement reçoit <envoyé>

    Exemples:
      | dernier | gagné   | envoyé           |
      | 0       | 0       | aucun score      |
      | 0       | 800     | un score de 800  |
      | 1000    | 900     | aucun score      |
      | 1000    | 1000    | aucun score      |
      | 1000    | 1001    | un score de 1001 |
      | 0       | 1000000 | un score de 1000000 |
      | 0       | 1500000 | un score de 1000000 |

  Scénario: Un invité garde sa sauvegarde mais n'envoie aucun score
    Étant donné un invité
    Quand sa progression est sauvegardée avec 800 $ gagnés
    Alors sa sauvegarde indique 800 $ gagnés
    Et le classement ne reçoit aucun score
