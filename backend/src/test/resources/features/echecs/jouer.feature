# language: fr
# Écrit AVANT le service (double boucle BDD → TDD) : rouge tant que EchecsService n'existe pas.
# @en-cours : exclu de mvn verify pendant la boucle interne TDD ; le tag est retiré quand le service est prêt.
@echecs @jouer @en-cours
Fonctionnalité: Jouer un coup
  En tant que joueur d'échecs
  Je veux jouer un coup et obtenir la position qui en résulte
  Afin de mener une partie qui respecte les règles

  Scénario: Ouverture 1.e4 : le pion avance de deux cases et c'est aux Noirs de jouer
    Étant donné la position de départ
    Quand je joue de "e2" vers "e4"
    Alors la position est "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

  Scénario: Une courte partie : 1.e4 e5 2.Cf3
    Étant donné la position de départ
    Quand je joue de "e2" vers "e4"
    Et je joue de "e7" vers "e5"
    Et je joue de "g1" vers "f3"
    Alors la position est "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"

  Scénario: Un coup interdit est refusé et la position ne change pas
    Étant donné la position de départ
    Quand je joue de "e2" vers "e5"
    Alors le coup est refusé
    Et la position est "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  Scénario: Les Noirs ne peuvent pas jouer en premier
    Étant donné la position de départ
    Quand je joue de "e7" vers "e5"
    Alors le coup est refusé
