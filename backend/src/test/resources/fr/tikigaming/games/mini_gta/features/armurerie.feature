# language: fr
Fonctionnalité: Armurerie (R5)
  Pour m'équiper avant une mission
  En tant que joueur
  Je veux acheter armes, munitions et gilet au prix affiché, jamais à crédit

  Plan du scénario: Chaque arme a son prix
    Étant donné un joueur qui a 5000 $
    Quand il achète l'arme "<arme>"
    Alors l'achat est accepté au prix de <prix> $
    Et son solde est de <solde> $

    Exemples:
      | arme    | prix | solde |
      | bat     | 100  | 4900  |
      | pistol  | 300  | 4700  |
      | grenade | 400  | 4600  |
      | shotgun | 1200 | 3800  |
      | rifle   | 1500 | 3500  |
      | sniper  | 2500 | 2500  |

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
      | arme    | prix | balles |
      | pistol  | 60   | 36     |
      | shotgun | 120  | 24     |
      | rifle   | 150  | 90     |
      | sniper  | 200  | 15     |
      | grenade | 400  | 5      |

  Plan du scénario: Un achat sans les fonds est refusé, sans débit
    Étant donné un joueur qui a <solde> $
    Quand il achète l'arme "pistol"
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
    Quand il demande l'article "<article>" pour l'arme "<arme>"
    Alors la demande est refusée avec le code 400

    Exemples:
      | article | arme  |
      | weapon  | fists |
      | ammo    | fists |
      | ammo    | bat   |
