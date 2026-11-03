# language: fr
Fonctionnalité: Enregistrement des scores
  Pour que le classement reste juste,
  en tant que plateforme, je refuse les scores impossibles
  et je ne perds pas le score d'un joueur quand le réseau coupe.

  Plan du scénario: Bornes d'un score
    Soit un joueur connecté sur un jeu dont le score maximal est <max>
    Quand il termine une partie avec <score> points
    Alors le score est <résultat>

    Exemples:
      | max | score | résultat |
      | 300 | -1    | refusé   |
      | 300 | 0     | accepté  |
      | 300 | 299   | accepté  |
      | 300 | 300   | accepté  |
      | 300 | 301   | refusé   |
      | 300 | 1.5   | refusé   |

  Scénario: Un invité joue sans être classé
    Soit un invité sur un jeu dont le score maximal est 300
    Quand il termine une partie avec 120 points
    Alors le score n'est pas enregistré

  Scénario: Une coupure réseau ne fait pas perdre le score
    Soit un joueur connecté sur un jeu dont le score maximal est 300
    Et le réseau est coupé
    Quand il termine une partie avec 120 points
    Alors il est prévenu que son score est gardé sur l'appareil
    Quand le réseau revient et qu'il termine une partie avec 80 points
    Alors ses scores 120 et 80 sont enregistrés
