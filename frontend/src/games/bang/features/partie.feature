# language: fr
Fonctionnalité: Créer une table et jouer ses tours
  Pour jouer à BANG ! avec trois autres joueurs
  En tant que joueur connecté
  Je veux créer une table, la démarrer, puis jouer mes tours

  Scénario: Créer une table affiche le code à partager
    Quand je crée une table
    Alors le code "ABC123" est affiché pour les autres joueurs
    Et le plateau n'est pas encore affiché

  Scénario: Une fois la partie démarrée, je pioche à mon tour
    Étant donné que c'est à mon tour de piocher
    Quand je crée une table et je démarre la partie
    Alors le plateau est affiché
    Et piocher envoie la pioche au serveur
