# language: fr
Fonctionnalité: Nouvelle partie (R2)
  En tant que joueur
  Je veux qu'une nouvelle partie commence toujours de la même façon, même si ma sauvegarde est abîmée
  Afin de démarrer sur un pied d'égalité avec les autres joueurs

  Scénario: Une nouvelle partie commence avec 500 $, sans armure et les poings en main
    Quand un joueur commence une nouvelle partie
    Alors il a 500 $
    Et il n'a encore rien gagné
    Et il n'a pas d'armure
    Et il a les poings en main
    Et il ne possède aucune autre arme
    Et aucune mission n'est terminée

  Scénario: Une sauvegarde valide est reprise
    Étant donné une sauvegarde avec 2400 $ et la mission "express" terminée
    Quand le jeu charge la sauvegarde
    Alors il a 2400 $
    Et la mission "express" est terminée

  Plan du scénario: Une sauvegarde corrompue ou d'une autre version donne une nouvelle partie
    Étant donné une sauvegarde <défaut>
    Quand le jeu charge la sauvegarde
    Alors il a 500 $
    Et il n'a encore rien gagné

    Exemples:
      | défaut                       |
      | d'une autre version du jeu   |
      | avec un solde négatif        |
      | avec des gains non entiers   |
      | avec une armure au-delà de 100 |
