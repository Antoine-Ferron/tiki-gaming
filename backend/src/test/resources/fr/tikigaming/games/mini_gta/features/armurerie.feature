# language: fr
Fonctionnalité: Armurerie (R5)
  En tant que joueur
  Je veux acheter armes, munitions et gilet au prix affiché, jamais à crédit
  Afin de m'équiper avant une mission

  Plan du scénario: Chaque arme a son prix
    Étant donné un joueur qui a 5000 $
    Quand il achète l'arme "<arme>"
    Alors l'achat est accepté au prix de <prix> $
    Et son solde est de <solde> $

    Exemples:
      | arme           | prix | solde |
      | batte          | 100  | 4900  |
      | pistolet       | 300  | 4700  |
      | grenades       | 400  | 4600  |
      | fusil à pompe  | 1200 | 3800  |
      | fusil d'assaut | 1500 | 3500  |
      | sniper         | 2500 | 2500  |

  Scénario: Le gilet coûte 250 $
    Étant donné un joueur qui a 1000 $
    Quand il achète le gilet
    Alors l'achat est accepté au prix de 250 $
    Et son solde est de 750 $

  Plan du scénario: Les munitions se vendent par lots
    Étant donné un joueur qui a 1000 $
    Quand il achète des munitions pour l'arme "<arme>"
    Alors l'achat est accepté au prix de <prix> $
    Et il reçoit <balles> munitions

    Exemples:
      | arme           | prix | balles |
      | pistolet       | 60   | 36     |
      | fusil à pompe  | 120  | 24     |
      | fusil d'assaut | 150  | 90     |
      | sniper         | 200  | 15     |
      | grenades       | 400  | 5      |

  Plan du scénario: Un achat sans les fonds est refusé, sans débit
    Étant donné un joueur qui a <solde> $
    Quand il achète l'arme "pistolet"
    Alors l'achat est <résultat>
    Et son solde est de <solde après> $

    Exemples:
      | solde | résultat | solde après |
      | 0     | refusé   | 0           |
      | 299   | refusé   | 299         |
      | 300   | accepté  | 0           |
      | 301   | accepté  | 1           |

  Plan du scénario: L'armurerie ne vend ni les poings ni de munitions pour une arme blanche
    Étant donné un joueur qui a 5000 $
    Quand il demande <article>
    Alors l'armurerie répond que l'article n'est pas vendu
    Et son solde est de 5000 $

    Exemples:
      | article                         |
      | l'arme "poings"                 |
      | des munitions pour les "poings" |
      | des munitions pour la "batte"   |
