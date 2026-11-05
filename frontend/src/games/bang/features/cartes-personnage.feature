# language: fr
Fonctionnalité: Cartes Personnage
  Pour choisir ma façon de jouer
  En tant que joueur
  Je veux que chaque carte Personnage affiche son nom, ses points de vie de départ et son pouvoir

  Plan du scénario: Un personnage affiche son nom, ses points de vie et son pouvoir
    Quand la carte "<personnage>" est affichée
    Alors elle montre le nom "<nom>" et <pv> points de vie
    Et son pouvoir mentionne "<extrait>"

    Exemples:
      | personnage     | nom            | pv | extrait                     |
      | bart-cassidy   | Bart Cassidy   | 4  | il pioche une carte         |
      | calamity-janet | Calamity Janet | 4  | BANG ! comme un Raté !      |
      | paul-regret    | Paul Regret    | 3  | distance augmentée de 1     |
      | willy-the-kid  | Willy le Kid   | 4  | autant de BANG ! qu'il veut |
