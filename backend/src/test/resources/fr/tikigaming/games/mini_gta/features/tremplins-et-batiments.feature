# language: fr
Fonctionnalité: Tremplins (R9) et bâtiments ouverts (R10)
  Pour explorer la ville autrement qu'en roulant sur la route
  En tant que joueur
  Je veux des tremplins où décoller et des rez-de-chaussée où entrer

  Contexte:
    Soit la ville du jeu

  Plan du scénario: La ville a des tremplins de chaque matière
    Alors la ville a au moins un tremplin en <matière>

    Exemples:
      | matière |
      | terre   |
      | béton   |
      | planches |

  Scénario: Les tremplins restent hors du trafic
    Alors aucun tremplin n'empiète sur une route empruntée par le trafic
    Et aucun tremplin ne chevauche un bâtiment
    Et aucun tremplin n'est dans l'eau

  Scénario: Environ un bâtiment ordinaire sur cinq est ouvert
    Alors entre 15 % et 25 % des bâtiments ordinaires ont un rez-de-chaussée accessible
    Et des maisons comme des immeubles sont ouverts

  Scénario: Seul le rez-de-chaussée d'un bâtiment ouvert est accessible
    Alors chaque bâtiment ouvert a une porte du côté de la rue
    Et le rez-de-chaussée de chaque bâtiment ouvert fait au moins 2,8 m de haut, sans dépasser le bâtiment
