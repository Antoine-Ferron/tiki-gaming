# language: fr
Fonctionnalité: Réapparition après une mort ou une arrestation (R7)
  En tant que joueur
  Je veux payer des frais d'hôpital ou une caution, sans jamais finir à découvert
  Afin que mourir ou se faire arrêter ait un coût

  Plan du scénario: Les frais d'hôpital sont de 10 % de l'argent, 100 $ minimum
    Étant donné un joueur qui a <solde> $
    Quand il meurt
    Alors il paie <frais> $
    Et son solde est de <solde après> $

    Exemples:
      | solde | frais | solde après |
      | 0     | 100   | 0           |
      | 50    | 100   | 0           |
      | 994   | 100   | 894         |
      | 995   | 100   | 895         |
      | 1004  | 100   | 904         |
      | 1005  | 101   | 904         |
      | 5000  | 500   | 4500        |

  Plan du scénario: La caution est de 15 % de l'argent, 200 $ minimum
    Étant donné un joueur qui a <solde> $
    Quand il est arrêté
    Alors il paie <frais> $
    Et son solde est de <solde après> $

    Exemples:
      | solde | frais | solde après |
      | 0     | 200   | 0           |
      | 150   | 200   | 0           |
      | 1336  | 200   | 1136        |
      | 1337  | 201   | 1136        |
      | 10000 | 1500  | 8500        |
