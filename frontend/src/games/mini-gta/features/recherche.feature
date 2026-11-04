# language: fr
Fonctionnalité: Niveau de recherche (R6)
  Pour que la police réagisse à mes crimes, sans me poursuivre indéfiniment
  En tant que joueur
  Je veux que mes crimes fassent monter le niveau de recherche, et qu'il retombe une fois hors de vue

  Plan du scénario: Les crimes vus par un témoin font monter le niveau de recherche
    Quand il commet <fois> fois le crime "<crime>" devant un témoin
    Alors il est recherché avec <étoiles> étoile(s)

    Exemples:
      | crime                 | fois | étoiles |
      | agression             | 1    | 1       |
      | vol de voiture        | 1    | 1       |
      | meurtre d'un passant  | 1    | 1       |
      | meurtre d'un passant  | 2    | 2       |
      | meurtre d'un policier | 2    | 3       |
      | meurtre d'un policier | 4    | 4       |
      | meurtre d'un policier | 6    | 5       |
      | meurtre d'un policier | 10   | 5       |

  Scénario: Un crime sans témoin ne compte pas
    Quand il commet 3 fois le crime "meurtre d'un policier" sans témoin
    Alors il n'est pas recherché

  Plan du scénario: Hors de vue de la police, le niveau finit par retomber
    Étant donné un joueur recherché avec <étoiles> étoile(s)
    Quand la police le perd de vue pendant <secondes> secondes, <où> la zone de recherche
    Alors il est recherché avec <reste> étoile(s)

    Exemples:
      | étoiles | secondes | où      | reste |
      | 1       | 17       | dans    | 1     |
      | 1       | 18       | dans    | 0     |
      | 2       | 23       | dans    | 2     |
      | 2       | 24       | dans    | 0     |
      | 1       | 7        | hors de | 1     |
      | 1       | 8        | hors de | 0     |

  Scénario: Repéré par la police, le joueur doit à nouveau se cacher
    Étant donné un joueur recherché avec 1 étoile(s)
    Quand la police le perd de vue pendant 17 secondes, dans la zone de recherche
    Et la police le repère
    Et la police le perd de vue pendant 17 secondes, dans la zone de recherche
    Alors il est recherché avec 1 étoile(s)
