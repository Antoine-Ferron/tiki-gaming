# language: fr
Fonctionnalité: Garder le résultat d'une rencontre locale de dames
  En tant que participants à une partie sur le même ordinateur
  Nous voulons retrouver nos noms et le gagnant de notre rencontre
  Afin de garder un résultat fidèle à la partie jouée

  Scénario: Démarrer une rencontre avec les noms des deux participants
    Étant donné que "Cherif" joue les blancs et "Amadou" joue les noirs
    Quand ils démarrent leur rencontre
    Alors une rencontre en cours est enregistrée avec ces deux noms
    Et aucun gagnant n'est encore désigné

  Plan du scénario: Le nom de chaque participant doit respecter les limites prévues
    Étant donné un joueur blanc nommé "Cherif"
    Quand il démarre une rencontre avec un joueur noir dont le nom comporte <longueur> lettres A
    Alors le démarrage est <résultat>

    Exemples:
      | longueur | résultat |
      | 0        | refusé   |
      | 1        | accepté  |
      | 50       | accepté  |
      | 51       | refusé   |

  Plan du scénario: Le gagnant de la partie devient le gagnant de la rencontre
    Étant donné une rencontre en cours avec "Cherif" aux blancs et "Amadou" aux noirs
    Quand le joueur <camp> remporte la partie
    Alors la rencontre est terminée et son gagnant est "<gagnant>"

    Exemples:
      | camp  | gagnant |
      | blanc | Cherif  |
      | noir  | Amadou  |

  Scénario: Refuser un résultat avant la fin de la partie
    Étant donné une rencontre dont la partie est toujours en cours
    Quand on tente d'enregistrer son résultat
    Alors l'enregistrement du résultat est refusé
    Et la rencontre reste en cours sans gagnant

  Scénario: Préserver le résultat d'une rencontre déjà terminée
    Étant donné une rencontre terminée dont le gagnant est "Cherif"
    Quand on tente de remplacer son gagnant par "Amadou"
    Alors la modification est refusée
    Et le gagnant reste "Cherif"
