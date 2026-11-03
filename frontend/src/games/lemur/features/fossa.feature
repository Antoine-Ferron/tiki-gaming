# language: fr
Fonctionnalité: La fossa
  Pour que la partie ait une fin
  En tant que joueur
  Je veux être poursuivi par une fossa de plus en plus rapide

  # EF-5.2 : la vitesse dépend de la hauteur maximale atteinte par le maki.
  Plan du scénario: La fossa accélère avec la hauteur, jusqu'à un maximum
    Étant donné le maki monté à <hauteur> m
    Quand le temps avance d'une seconde
    Alors la fossa est montée de <distance> m

    Exemples:
      | hauteur | distance |
      | 0       | 4        |
      | 99      | 4        |
      | 100     | 5.2      |
      | 10000   | 20       |

  # EF-5.3 : la fossa avance (4 m/s, soit 0,07 m par image), puis est ramenée à 40 m sous l'écran au plus.
  Plan du scénario: La fossa ne reste jamais à plus de 40 m sous l'écran
    Étant donné le bas de l'écran à 100 m
    Et la fossa à <avant> m sous le bas de l'écran
    Quand le temps avance d'une image
    Alors la fossa est à <après> m sous le bas de l'écran

    Exemples:
      | avant | après |
      | 100   | 40    |
      | 40.1  | 40    |
      | 40    | 39.93 |
