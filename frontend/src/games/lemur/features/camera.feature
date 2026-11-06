# language: fr
Fonctionnalité: Caméra
  Pour voir les branches vers lesquelles il grimpe
  En tant que joueur
  Je veux que l'écran suive le maki vers le haut, sans jamais redescendre

  # EF-2.1 : l'écran fait 64 m de haut, la caméra monte dès que le maki dépasse son milieu (32 m au-dessus du bas).
  Plan du scénario: La caméra suit le maki qui dépasse le milieu de l'écran
    Étant donné le bas de l'écran à 0 m
    Et le maki au sommet de son saut à <hauteur> m
    Quand le temps avance d'une image
    Alors le bas de l'écran est à <bas> m

    Exemples:
      | hauteur | bas |
      | 0       | 0   |
      | 32      | 0   |
      | 33      | 1   |
      | 100     | 68  |

  # EF-2.2
  Scénario: La caméra ne redescend jamais
    Étant donné le bas de l'écran à 68 m
    Et le maki au sommet de son saut à 90 m
    Quand le temps avance d'une image
    Alors le bas de l'écran est à 68 m
