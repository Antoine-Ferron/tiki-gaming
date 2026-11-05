# language: fr
Fonctionnalité: Score
  Pour me mesurer aux autres joueurs
  En tant que joueur
  Je veux un score qui compte la hauteur atteinte et la vanille ramassée

  # EF-6.4, EF-6.5 : mètres entiers atteints (arrondis à l'inférieur) + 10 par gousse, au plus 100 000.
  Plan du scénario: Le score compte la hauteur maximale et la vanille
    Étant donné le maki monté au plus haut à <hauteur> m
    Et <gousses> gousses de vanille ramassées
    Alors le score est de <score>

    Exemples:
      | hauteur  | gousses | score  |
      | 0        | 0       | 0      |
      | 123.9    | 0       | 123    |
      | 123.9    | 2       | 143    |
      | 99999.9  | 0       | 99999  |
      | 100000   | 0       | 100000 |
      | 100000.5 | 0       | 100000 |
      | 99995    | 1       | 100000 |

  # EF-6.4 : la hauteur maximale est celle des pieds du maki, et ne redescend jamais.
  Plan du scénario: La hauteur maximale suit le maki sans jamais redescendre
    Étant donné le maki monté au plus haut à <avant> m
    Et le maki au sommet de son saut à <maki> m
    Quand la partie avance d'une image
    Alors le maki est monté au plus haut à <après> m

    Exemples:
      | avant | maki | après |
      | 20    | 30   | 30    |
      | 30    | 30   | 30    |
      | 50    | 30   | 50    |
