# language: fr
Fonctionnalité: LemurTiki sur la plateforme
  Pour comparer mes ascensions à celles des autres
  En tant que joueur
  Je veux que mon score parte au classement à la fin de chaque partie

  # EF-8.1, EF-8.2
  Scénario: Le score d'une partie terminée est envoyé une fois
    Étant donné un joueur connecté
    Quand il termine une partie avec 150 m et 1 gousse de vanille
    Alors un seul score de 160 est enregistré pour lui, avec la hauteur, la vanille et la cause
    Et le classement affiche 160 sur sa ligne

  # EF-8.3
  Scénario: Un invité joue sans être classé
    Étant donné un invité
    Quand il termine une partie avec 150 m et 1 gousse de vanille
    Alors aucun score n'est enregistré
    Et il voit « Connecte-toi pour apparaître au classement. »

  # EF-8.5 : résilience, la panne est simulée par le fake des scores.
  Scénario: Une coupure réseau n'empêche pas de rejouer
    Étant donné un joueur connecté et la connexion coupée
    Quand il termine une partie avec 150 m et 1 gousse de vanille
    Alors il voit le message de score gardé sur l'appareil
    Et la partie suivante se termine normalement, et les deux scores sont enregistrés
