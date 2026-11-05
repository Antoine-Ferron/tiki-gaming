# language: fr
Fonctionnalité: Respecter les prises et la victoire aux dames internationales
  En tant que joueur de dames
  Je veux que les mêmes règles s'appliquent aux deux camps
  Afin que la partie soit équitable

  Scénario: Prendre une pièce est obligatoire lorsqu'une prise est possible
    Étant donné que les blancs ont le trait et peuvent capturer une pièce noire
    Quand les blancs choisissent un déplacement sans prise
    Alors le déplacement est refusé
    Et le plateau et le joueur au trait restent inchangés

  Scénario: Choisir la prise du plus grand nombre de pièces
    Étant donné que les blancs ont le trait et peuvent capturer soit deux pièces, soit trois pièces
    Quand les blancs choisissent la prise de deux pièces
    Alors cette prise est refusée
    Et le plateau et le joueur au trait restent inchangés

  Scénario: Capturer la dernière pièce adverse donne la victoire
    Étant donné que les noirs n'ont plus qu'une pièce et que les blancs ont le trait
    Et que cette pièce noire peut être capturée par les blancs
    Quand les blancs capturent cette dernière pièce
    Alors les blancs remportent la partie
