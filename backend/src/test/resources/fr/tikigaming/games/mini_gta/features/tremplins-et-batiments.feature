# language: fr
Fonctionnalité: Tremplins (R9) et bâtiments ouverts (R10)
  En tant que joueur
  Je veux des tremplins où décoller et des rez-de-chaussée où entrer
  Afin d'explorer la ville autrement qu'en roulant sur la route

  Contexte:
    Étant donné la ville du jeu

  Plan du scénario: La ville a des tremplins de chaque matière
    Quand on recense ses tremplins
    Alors au moins un tremplin est en <matière>

    Exemples:
      | matière  |
      | terre    |
      | béton    |
      | planches |

  Scénario: Les tremplins restent hors du trafic
    Quand on recense ses tremplins
    Alors aucun tremplin n'empiète sur une route empruntée par le trafic
    Et aucun tremplin ne chevauche un bâtiment
    Et aucun tremplin n'est dans l'eau

  Scénario: Environ un bâtiment ordinaire sur cinq est ouvert
    Quand on recense ses bâtiments ouverts
    Alors entre 15 % et 25 % des bâtiments ordinaires sont ouverts
    Et des maisons comme des immeubles sont ouverts

  Scénario: Seul le rez-de-chaussée d'un bâtiment ouvert est accessible
    Quand on recense ses bâtiments ouverts
    Alors chacun a sa porte du côté de la rue
    Et le rez-de-chaussée de chacun fait au moins 2,8 m de haut, sans dépasser le bâtiment
