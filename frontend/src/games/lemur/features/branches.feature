# language: fr
Fonctionnalité: Branches du baobab
  Pour pouvoir grimper sans fin
  En tant que joueur
  Je veux toujours trouver une branche à ma portée au-dessus de moi

  # EF-3.1 : l'écran fait 64 m de haut ; les branches poussent jusqu'à un écran au-dessus de son haut.
  Plan du scénario: Des branches attendent toujours au-dessus de l'écran
    Étant donné le bas de l'écran à <bas> m
    Quand les branches poussent
    Alors la plus haute branche est au moins à <haut> m

    Exemples:
      | bas | haut |
      | 0   | 128  |
      | 500 | 628  |

  # EF-3.1
  Plan du scénario: Les branches passées sous l'écran disparaissent
    Étant donné le bas de l'écran à 20 m
    Et une branche dont le dessus est à <dessus> m
    Quand les branches poussent
    Alors cette branche <résultat>

    Exemples:
      | dessus | résultat   |
      | 19.9   | a disparu  |
      | 20     | est gardée |

  # EF-3.2
  Plan du scénario: Une branche est toujours à portée de saut
    Étant donné un tirage au sort qui donne toujours <tirage>
    Quand les branches poussent jusqu'à 3000 m
    Alors des branches montent jusqu'à au moins 3000 m
    Et l'écart entre deux branches successives reste inférieur à la hauteur d'un saut normal
    Et toutes les branches sont entièrement dans l'écran

    Exemples:
      | tirage |
      | 0      |
      | 0.5    |
      | 0.999  |
