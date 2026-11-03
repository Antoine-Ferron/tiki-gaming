# language: fr
Fonctionnalité: Fin de partie
  Pour que chaque partie compte
  En tant que joueur
  Je veux que la partie s'arrête quand je tombe ou quand la fossa m'attrape

  # EF-6.1 : le maki (3 m de haut) tombe quand il est entièrement passé sous le bas de l'écran.
  Plan du scénario: Le maki tombe sous l'écran
    Étant donné le bas de l'écran à 50 m
    Et le maki au sommet de son saut, la tête à <tête> m
    Quand la partie avance d'une image
    Alors la fin de partie est « <fin> »

    Exemples:
      | tête | fin              |
      | 50.1 | aucune           |
      | 50   | aucune           |
      | 49.9 | le maki est tombé |

  # EF-6.2 : au départ la fossa monte de 4 m/s, soit 0,07 m par image.
  Plan du scénario: La fossa rattrape le maki
    Étant donné le maki au sommet de son saut à 30 m
    Et la fossa <écart> m sous ses pieds
    Quand la partie avance d'une image
    Alors la fin de partie est « <fin> »

    Exemples:
      | écart | fin                         |
      | 0.1   | aucune                      |
      | 0.06  | la fossa a attrapé le maki  |
      | 0     | la fossa a attrapé le maki  |

  # EF-6.3
  Scénario: Après la fin, plus rien ne bouge
    Étant donné une partie terminée
    Quand le joueur dirige le maki à droite pendant 10 images
    Alors la partie n'a pas changé
    Et aucun tirage au sort n'a eu lieu
